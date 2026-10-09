import { create } from 'zustand';
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
} from '@xyflow/react';

export interface NodeExecState {
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  durationMs?: number;
  output?: any;
  error?: string;
  selectedPort?: string;
}

interface WorkflowHistoryState {
  nodes: Node[];
  edges: Edge[];
}

interface WorkflowStore {
  workflowId: string | null;
  workflowName: string;
  workflowVersion: number;
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  activeInspectorTab: 'parameters' | 'data' | 'copilot';

  isSaving: boolean;
  isDirty: boolean;
  isExecuting: boolean;
  activeExecutionId: string | null;
  nodeExecStates: Record<string, NodeExecState>;

  past: WorkflowHistoryState[];
  future: WorkflowHistoryState[];

  // Actions
  setWorkflow: (wf: any) => void;
  setWorkflowName: (name: string) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setSelectedNodeId: (id: string | null) => void;
  setActiveInspectorTab: (tab: 'parameters' | 'data' | 'copilot') => void;
  addNode: (type: string, position?: { x: number; y: number }) => void;
  updateNodeParameters: (nodeId: string, params: Record<string, any>) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  duplicateNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;

  // History Undo/Redo
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Execution
  setIsSaving: (isSaving: boolean) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  setActiveExecutionId: (id: string | null) => void;
  setNodeExecutionState: (nodeId: string, state: Partial<NodeExecState>) => void;
  resetExecutionState: () => void;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  workflowId: null,
  workflowName: 'Untitled Workflow',
  workflowVersion: 1,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  activeInspectorTab: 'parameters',

  isSaving: false,
  isDirty: false,
  isExecuting: false,
  activeExecutionId: null,
  nodeExecStates: {},

  past: [],
  future: [],

  setWorkflow: (wf) => {
    const rawGraph = wf.graph || { nodes: [], edges: [] };
    const initialNodes: Node[] = (rawGraph.nodes || []).map((n: any) => ({
      id: n.id,
      type: 'custom',
      position: n.position || { x: 100, y: 100 },
      data: {
        ...n.data,
        type: n.type,
      },
    }));

    const initialEdges: Edge[] = (rawGraph.edges || []).map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || null,
      targetHandle: e.targetHandle || null,
      type: 'smoothstep',
      animated: false,
    }));

    set({
      workflowId: wf.id,
      workflowName: wf.name || 'Untitled Workflow',
      workflowVersion: wf.version || 1,
      nodes: initialNodes,
      edges: initialEdges,
      selectedNodeId: initialNodes.length > 0 ? initialNodes[0].id : null,
      isDirty: false,
      past: [],
      future: [],
      nodeExecStates: {},
    });
  },

  setWorkflowName: (name) => {
    set({ workflowName: name, isDirty: true });
  },

  pushHistory: () => {
    const { nodes, edges, past } = get();
    set({
      past: [...past.slice(-20), { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }],
      future: [],
      isDirty: true,
    });
  },

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
      isDirty: true,
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    });
  },

  onConnect: (connection: Connection) => {
    get().pushHistory();
    set({
      edges: addEdge(
        {
          ...connection,
          type: 'smoothstep',
          animated: false,
        },
        get().edges
      ),
      isDirty: true,
    });
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setActiveInspectorTab: (tab) => set({ activeInspectorTab: tab }),

  addNode: (type, position) => {
    get().pushHistory();
    const id = `node_${type.replace('-', '_')}_${Date.now()}`;
    const defaultLabels: Record<string, string> = {
      'manual-trigger': 'Manual Trigger',
      'http-request': 'HTTP Request',
      'condition': 'Condition',
      'set-data': 'Set Data',
      'delay': 'Delay',
      'output': 'Output',
    };

    const newNode: Node = {
      id,
      type: 'custom',
      position: position || { x: 250 + get().nodes.length * 40, y: 150 + get().nodes.length * 40 },
      data: {
        label: defaultLabels[type] || type,
        type,
        parameters: {},
      },
    };

    set({
      nodes: [...get().nodes, newNode],
      selectedNodeId: id,
      isDirty: true,
    });
  },

  updateNodeParameters: (nodeId, params) => {
    get().pushHistory();
    set({
      nodes: get().nodes.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              parameters: {
                ...(n.data.parameters as Record<string, any>),
                ...params,
              },
            },
          };
        }
        return n;
      }),
      isDirty: true,
    });
  },

  updateNodeLabel: (nodeId, label) => {
    set({
      nodes: get().nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label } } : n)),
      isDirty: true,
    });
  },

  duplicateNode: (nodeId) => {
    const original = get().nodes.find((n) => n.id === nodeId);
    if (!original) return;
    get().pushHistory();

    const newId = `node_${(original.data.type as string).replace('-', '_')}_${Date.now()}`;
    const duplicated: Node = {
      id: newId,
      type: 'custom',
      position: { x: original.position.x + 40, y: original.position.y + 40 },
      data: JSON.parse(JSON.stringify(original.data)),
    };

    set({
      nodes: [...get().nodes, duplicated],
      selectedNodeId: newId,
      isDirty: true,
    });
  },

  deleteNode: (nodeId) => {
    get().pushHistory();
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      isDirty: true,
    });
  },

  undo: () => {
    const { past, future, nodes, edges } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    set({
      past: newPast,
      future: [{ nodes, edges }, ...future],
      nodes: previous.nodes,
      edges: previous.edges,
      isDirty: true,
    });
  },

  redo: () => {
    const { past, future, nodes, edges } = get();
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);

    set({
      past: [...past, { nodes, edges }],
      future: newFuture,
      nodes: next.nodes,
      edges: next.edges,
      isDirty: true,
    });
  },

  setIsSaving: (isSaving) => set({ isSaving }),
  setIsExecuting: (isExecuting) => set({ isExecuting }),
  setActiveExecutionId: (id) => set({ activeExecutionId: id }),

  setNodeExecutionState: (nodeId, state) => {
    set((s) => ({
      nodeExecStates: {
        ...s.nodeExecStates,
        [nodeId]: {
          ...(s.nodeExecStates[nodeId] || { status: 'pending' }),
          ...state,
        },
      },
    }));
  },

  resetExecutionState: () => {
    set({
      nodeExecStates: {},
      activeExecutionId: null,
      isExecuting: false,
    });
  },
}));
