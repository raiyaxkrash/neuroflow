import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserTestServer } from './fixtures/browser-test-server.js';
import { WorkflowExecutor } from '@neuroflow/workflow-engine';
import { ExecutionStatus } from '@neuroflow/shared';
import { BrowserSessionManager } from '@neuroflow/nodes';

describe('E2E Browser Workflow Scenario with Real Playwright', () => {
  const testServer = new BrowserTestServer();
  let baseUrl = '';

  beforeAll(async () => {
    baseUrl = await testServer.start();
  }, 15000);

  afterAll(async () => {
    await BrowserSessionManager.getInstance().closeAllSessions();
    await testServer.stop();
  });

  it('должен сквозным образом выполнять цепочку браузерных узлов в WorkflowExecutor', async () => {
    const browserWorkflowGraph = {
      nodes: [
        // 1. Browser Start
        {
          id: 'n_start',
          type: 'browser-start',
          position: { x: 0, y: 0 },
          data: {
            label: 'Start Browser',
            type: 'browser-start',
            parameters: {
              headless: true,
              allowLocalhost: true,
              sessionName: 'E2E-Pipeline-Session',
            },
          },
        },
        // 2. Browser Navigate
        {
          id: 'n_navigate',
          type: 'browser-navigate',
          position: { x: 200, y: 0 },
          data: {
            label: 'Navigate to App',
            type: 'browser-navigate',
            parameters: {
              url: baseUrl,
              allowLocalhost: true,
            },
          },
        },
        // 3. Browser Type
        {
          id: 'n_type',
          type: 'browser-type',
          position: { x: 400, y: 0 },
          data: {
            label: 'Type Search Query',
            type: 'browser-type',
            parameters: {
              selector: '#query-input',
              text: 'End-to-End Automation 2026',
            },
          },
        },
        // 4. Browser Click
        {
          id: 'n_click',
          type: 'browser-click',
          position: { x: 600, y: 0 },
          data: {
            label: 'Submit Search',
            type: 'browser-click',
            parameters: {
              selector: '#search-submit',
            },
          },
        },
        // 5. Browser Extract
        {
          id: 'n_extract',
          type: 'browser-extract',
          position: { x: 800, y: 0 },
          data: {
            label: 'Extract Result',
            type: 'browser-extract',
            parameters: {
              selector: '#search-result',
              extractType: 'text',
            },
          },
        },
        // 6. Browser Screenshot
        {
          id: 'n_screenshot',
          type: 'browser-screenshot',
          position: { x: 1000, y: 0 },
          data: {
            label: 'Take Screenshot',
            type: 'browser-screenshot',
            parameters: {
              format: 'jpeg',
            },
          },
        },
        // 7. Browser Close
        {
          id: 'n_close',
          type: 'browser-close',
          position: { x: 1200, y: 0 },
          data: {
            label: 'Close Session',
            type: 'browser-close',
            parameters: {},
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'n_start', target: 'n_navigate' },
        { id: 'e2', source: 'n_navigate', target: 'n_type' },
        { id: 'e3', source: 'n_type', target: 'n_click' },
        { id: 'e4', source: 'n_click', target: 'n_extract' },
        { id: 'e5', source: 'n_extract', target: 'n_screenshot' },
        { id: 'e6', source: 'n_screenshot', target: 'n_close' },
      ],
    };

    const completedNodes: string[] = [];

    const executionResult = await WorkflowExecutor.execute({
      executionId: 'e2e_browser_exec_001',
      workflowId: 'e2e_browser_wf_001',
      graph: browserWorkflowGraph,
      initialPayload: {},
      saveToDatabase: false,
      events: {
        onNodeComplete: (nodeId) => {
          completedNodes.push(nodeId);
        },
      },
    });

    expect(executionResult.status).toBe(ExecutionStatus.SUCCESS);
    expect(completedNodes).toEqual([
      'n_start',
      'n_navigate',
      'n_type',
      'n_click',
      'n_extract',
      'n_screenshot',
      'n_close',
    ]);

    // Проверяем результат извлечения данных
    const extractOutput = executionResult.outputs['n_extract'];
    expect(extractOutput).toBeDefined();
    expect(extractOutput.data).toContain('Найдено: End-to-End Automation 2026');

    // Проверяем скриншот
    const shotOutput = executionResult.outputs['n_screenshot'];
    expect(shotOutput).toBeDefined();
    expect(shotOutput.base64).toBeTruthy();
    expect(shotOutput.mimeType).toBe('image/jpeg');

    // Проверяем закрытие сессии
    const closeOutput = executionResult.outputs['n_close'];
    expect(closeOutput.closed).toBe(true);
  }, 35000);
});
