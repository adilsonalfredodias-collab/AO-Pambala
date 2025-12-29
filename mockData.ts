
import { Product, Client, Transaction } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Camiseta Básica Preta',
    sku: 'CMB-001',
    category: 'Vestuário',
    costPrice: 25.00,
    salePrice: 49.90,
    stock: 12,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=200&auto=format&fit=crop',
    description: 'Camiseta básica de algodão fio 30.1'
  },
  {
    id: '2',
    name: 'Calça Jeans Skinny',
    sku: 'CJS-042',
    category: 'Vestuário',
    costPrice: 65.00,
    salePrice: 119.90,
    stock: 5,
    image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=200&auto=format&fit=crop',
    description: 'Calça jeans com elastano corte skinny'
  },
  {
    id: '3',
    name: 'Tênis Casual Branco',
    sku: 'TCB-088',
    category: 'Calçados',
    costPrice: 95.00,
    salePrice: 189.90,
    stock: 0,
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=200&auto=format&fit=crop',
    description: 'Tênis casual sintético resistente'
  }
];

export const INITIAL_CLIENTS: Client[] = [
  { id: '1', name: 'Ana Silva', phone: '(11) 98765-4321', email: 'ana@email.com', lastPurchase: 'Hoje', status: 'active' },
  { id: '2', name: 'Carlos Souza', phone: '(21) 91234-5678', email: 'carlos@email.com', lastPurchase: '2 dias atrás', status: 'active' },
  { id: '3', name: 'Mariana Costa', phone: '(31) 99876-5432', email: 'mari@email.com', lastPurchase: '1 semana atrás', status: 'pending' }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: 't1', description: 'Venda #1023', amount: 150.00, date: '2024-06-24', time: '14:30', category: 'Vendas', type: 'income' },
  { id: 't2', description: 'Compra de embalagens', amount: -150.00, date: '2024-06-24', time: '12:00', category: 'Estoque', type: 'expense' },
  { id: 't3', description: 'Venda Balcão', amount: 45.90, date: '2024-06-24', time: '11:15', category: 'Vendas', type: 'income' },
  { id: 't4', description: 'Conta de Luz', amount: -320.50, date: '2024-06-23', time: '09:00', category: 'Contas', type: 'expense' }
];
