import { describe, it, expect } from 'vitest';
import { UniversalToolRegistry, safeCalculate } from '@neuroflow/nodes';

describe('Universal Tool Registry & Built-in Tools', () => {
  it('безопасный калькулятор корректно производит математические вычисления', () => {
    expect(safeCalculate('2 + 2')).toBe(4);
    expect(safeCalculate('(10 + 5) * 2')).toBe(30);
    expect(safeCalculate('100 / (2 + 3) * 4')).toBe(80);
    expect(safeCalculate('2 ^ 3')).toBe(8);
  });

  it('калькулятор выбрасывает ошибку при делении на ноль и опасных символах', () => {
    expect(() => safeCalculate('10 / 0')).toThrow('Деление на ноль');
    expect(() => safeCalculate('process.exit()')).toThrow('недопустимые символы');
    expect(() => safeCalculate('2 + import("fs")')).toThrow('недопустимые символы');
  });

  it('json_processor корректно извлекает вложенные свойства и элементы массива', async () => {
    const registry = UniversalToolRegistry.getInstance();
    const data = {
      order: {
        id: 'ord-123',
        customer: { name: 'Alice', email: 'alice@example.com' },
        items: [
          { sku: 'item-1', price: 100 },
          { sku: 'item-2', price: 250 },
        ],
      },
    };

    const res1 = await registry.executeTool('json_processor', {
      json: data,
      path: 'order.customer.name',
    });
    expect(res1.success).toBe(true);
    expect(res1.data.result).toBe('Alice');

    const res2 = await registry.executeTool('json_processor', {
      json: data,
      path: 'order.items[1].price',
    });
    expect(res2.success).toBe(true);
    expect(res2.data.result).toBe(250);
  });

  it('проверка прав доступа агента к инструментам (isToolAllowed)', () => {
    const registry = UniversalToolRegistry.getInstance();

    // Разрешено всё
    expect(registry.isToolAllowed(['*'], 'calculator')).toBe(true);
    expect(registry.isToolAllowed(['*'], 'mcp:github:list_issues')).toBe(true);

    // Только встроенные
    expect(registry.isToolAllowed(['builtin:*'], 'calculator')).toBe(true);
    expect(registry.isToolAllowed(['builtin:*'], 'web_fetch')).toBe(true);
    expect(registry.isToolAllowed(['builtin:*'], 'mcp:github:list_issues')).toBe(false);

    // Только определенный сервер MCP
    expect(registry.isToolAllowed(['mcp:github:*'], 'mcp:github:list_issues')).toBe(true);
    expect(registry.isToolAllowed(['mcp:github:*'], 'mcp:postgres:query')).toBe(false);

    // Точные имена
    expect(registry.isToolAllowed(['calculator', 'json_processor'], 'calculator')).toBe(true);
    expect(registry.isToolAllowed(['calculator', 'json_processor'], 'web_fetch')).toBe(false);
  });

  it('executeTool возвращает ошибку, если инструмент не разрешен для агента', async () => {
    const registry = UniversalToolRegistry.getInstance();
    const result = await registry.executeTool(
      'calculator',
      { expression: '5 * 5' },
      { allowedTools: ['web_fetch'] } // calculator не разрешен
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Доступ запрещен');
  });
});
