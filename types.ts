
export type View = 'home' | 'products' | 'clients' | 'sales' | 'adjustments' | 'productForm' | 'clientForm' | 'reports' | 'saleSuccess' | 'manualSaleDetails';

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  image: string;
  description: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  lastPurchase?: string;
  status: 'active' | 'pending';
}

export interface SaleItem {
  productId: string;
  quantity: number;
  priceAtSale: number;
}

export type PaymentMethod = 'Dinheiro em Mão' | 'Transferência' | 'Depósito';
export type Gender = 'Masculino' | 'Feminino' | 'Outro';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  time: string;
  category: string;
  type: 'income' | 'expense';
  customerName?: string;
  customerGender?: Gender;
  paymentMethod?: PaymentMethod;
  deliveryLocation?: string;
  discount?: number;
  items?: SaleItem[];
}
