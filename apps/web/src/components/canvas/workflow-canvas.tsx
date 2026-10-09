'use client';

import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CustomNode } from './custom-node';
import { useWorkflowStore } from '@/store/workflow-store';

const nodeTypes = {
  custom: CustomNode,
};

export function WorkflowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const addNode = useWorkflowStore((s) => s.addNode);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData('application/neuroflow-node');
      if (!nodeType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(nodeType, position);
    },
    [screenToFlowPosition, addNode]
  );

  return (
    <div ref={reactFlowWrapper} className="w-full h-full relative select-none bg-[#0D0E15]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        nodeTypes={nodeTypes}
        fitView
        onDragOver={onDragOver}
        onDrop={onDrop}
        snapToGrid
        snapGrid={[20, 20]}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: 'rgba(255, 255, 255, 0.25)', strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="rgba(255, 255, 255, 0.08)"
        />
        <Controls
          className="!bg-[#12141F] !border !border-white/10 !rounded-lg !overflow-hidden [&>button]:!bg-transparent [&>button]:!border-white/5 [&>button]:!text-slate-300 hover:[&>button]:!bg-white/10"
        />
        <MiniMap
          nodeColor={(node) => {
            const type = (node.data?.type as string) || '';
            if (type === 'manual-trigger') return '#8B5CF6';
            if (type === 'http-request') return '#06B6D4';
            if (type === 'condition') return '#F59E0B';
            if (type === 'output') return '#10B981';
            return '#6366F1';
          }}
          className="!bg-[#12141F] !border !border-white/10 !rounded-lg !overflow-hidden"
          maskColor="rgba(13, 14, 21, 0.8)"
        />
      </ReactFlow>
    </div>
  );
}
