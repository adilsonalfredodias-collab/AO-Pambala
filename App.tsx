
import React, { useState, useEffect, useMemo } from 'react';
import { View, Product, Client, Transaction, SaleItem, PaymentMethod, Gender, ClientCategory } from './types';
import { INITIAL_PRODUCTS, INITIAL_CLIENTS, INITIAL_TRANSACTIONS } from './mockData';
import { generateProductDescription } from './geminiService';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';

const MUNICIPAIS = ['Luanda', 'Belas', 'Cazenga', 'Cacuaco', 'Viana', 'Talatona', 'Kilamba Kiaxi', 'Icolo e Bengo', 'Quiçama'];
const CATEGORIAS_PRODUTO = ['Vestuário', 'Calçados', 'Acessórios', 'Eletrônicos', 'Beleza'];
const CATEGORIAS_CLIENTE: ClientCategory[] = ['Novo', 'Recorrente', 'VIP', 'Fiel'];

const Navigation: React.FC<{ activeView: View; setView: (v: View) => void }> = ({ activeView, setView }) => {
  const items: { id: View; icon: string; label: string }[] = [
    { id: 'home', icon: 'grid_view', label: 'Início' },
    { id: 'sales', icon: 'add_shopping_cart', label: 'Vendas' },
    { id: 'products', icon: 'inventory_2', label: 'Stock' },
    { id: 'expenses', icon: 'payments', label: 'Gastos' },
    { id: 'menu', icon: 'more_horiz', label: 'Menu' },
  ];

  const isSelected = (id: View) => {
    if (activeView === id) return true;
    if (id === 'sales' && activeView === 'manualSaleDetails') return true;
    if (id === 'menu' && ['clients', 'reports', 'profile', 'adjustments', 'clientForm'].includes(activeView)) return true;
    return false;
  };

  return (
    <nav className="fixed bottom-0 z-40 w-full max-w-md mx-auto left-0 right-0 bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
      <div className="flex h-16 items-center justify-around px-1">
        {items.map((item) => (
          <button key={item.id} onClick={() => setView(item.id)} className={`group flex flex-1 flex-col items-center gap-1 p-2 transition-all ${isSelected(item.id) ? 'text-primary scale-110' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}>
            <span className={`material-symbols-outlined text-[22px] ${isSelected(item.id) ? 'filled' : ''}`} style={{ fontVariationSettings: isSelected(item.id) ? "'FILL' 1" : "" }}>{item.icon}</span>
            <span className="text-[9px] font-bold uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

const Toast: React.FC<{ message: string; show: boolean }> = ({ message, show }) => (
  <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl transition-all duration-300 flex items-center gap-2 ${show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
    <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
    <span className="text-xs font-bold">{message}</span>
  </div>
);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [view, setView] = useState<View>('home');
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    storeName: 'Pambala Store AO',
    slogan: 'Qualidade e Confiança no nosso Kwanza',
    phone: '+244 923 000 000',
    address: 'Viana, Luanda',
    nif: '5001234567'
  });

  // Estados de Formulário
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [manualSale, setManualSale] = useState({
    customerName: '', customerGender: 'Feminino' as Gender, paymentMethod: 'Dinheiro em Mão' as PaymentMethod,
    deliveryLocation: 'Viana', discount: 0, date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    quantities: {} as Record<string, number>
  });

  // Estados de Edição
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ name: '', cat: 'Vestuário', price: '', stock: '', sku: '', cost: '' });
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState({ name: '', phone: '', email: '', category: 'Novo' as ClientCategory });
  
  const [iaDesc, setIaDesc] = useState('');
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);

  useEffect(() => {
    isDarkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  // --- Handlers de Produto ---
  const startAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: '', cat: 'Vestuário', price: '', stock: '', sku: '', cost: '' });
    setIaDesc('');
    setView('productForm');
  };

  const startEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({ name: p.name, cat: p.category, price: p.salePrice.toString(), stock: p.stock.toString(), sku: p.sku, cost: p.costPrice.toString() });
    setIaDesc(p.description);
    setView('productForm');
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    showToast("Produto removido do stock");
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? {
        ...p, name: productForm.name, category: productForm.cat, salePrice: Number(productForm.price),
        stock: Number(productForm.stock), sku: productForm.sku, costPrice: Number(productForm.cost), description: iaDesc
      } : p));
      showToast("Produto atualizado!");
    } else {
      const prod: Product = {
        id: `P${Date.now()}`, name: productForm.name, sku: productForm.sku || `SKU-${Math.floor(Math.random() * 1000)}`,
        category: productForm.cat, costPrice: Number(productForm.cost || 0), salePrice: Number(productForm.price),
        stock: Number(productForm.stock), image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=200&auto=format&fit=crop', description: iaDesc
      };
      setProducts(prev => [prod, ...prev]);
      showToast("Produto adicionado!");
    }
    setView('products');
  };

  // --- Handlers de Cliente ---
  const startEditClient = (c: Client) => {
    setEditingClient(c);
    setClientForm({ name: c.name, phone: c.phone, email: c.email, category: c.category });
    setView('clientForm');
  };

  const deleteClient = (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    showToast("Cliente removido!");
  };

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClient) {
      setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, ...clientForm } : c));
      showToast("Cliente atualizado!");
    } else {
      const cli: Client = { id: `C-${Date.now()}`, ...clientForm, status: 'active' };
      setClients(prev => [cli, ...prev]);
      showToast("Cliente cadastrado!");
    }
    setView('clients');
  };

  // --- Facturação ---
  const downloadInvoice = (saleId: string) => {
    const sale = transactions.find(t => t.id === saleId);
    if (!sale) return;
    let text = `FACTURA - ${profile.storeName}\nID: ${sale.id}\nData: ${sale.date}\nTotal: Kz ${sale.amount.toLocaleString()}\nObrigado!`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Factura_${saleId}.txt`; a.click();
    showToast("Factura descarregada!");
  };

  const handleSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const total = selectedProductIds.reduce((acc, id) => acc + (products.find(x => x.id === id)!.salePrice * (manualSale.quantities[id] || 1)), 0);
    const saleId = `VENDA-${Date.now()}`;
    const t: Transaction = {
      id: saleId, description: `Venda p/ ${manualSale.customerName}`, amount: total - manualSale.discount,
      date: manualSale.date, time: manualSale.time, category: 'Vendas', type: 'income', ...manualSale,
      items: selectedProductIds.map(id => ({ productId: id, quantity: manualSale.quantities[id] || 1, priceAtSale: products.find(p => p.id === id)!.salePrice }))
    };
    setProducts(prev => prev.map(p => {
      const item = t.items?.find(i => i.productId === p.id);
      return item ? { ...p, stock: Math.max(0, p.stock - item.quantity) } : p;
    }));
    setTransactions(prev => [t, ...prev]);
    setLastSaleId(saleId);
    setView('saleSuccess');
    setSelectedProductIds([]);
  };

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background-light dark:bg-background-dark p-8 justify-center items-center">
        <div className="size-20 bg-primary rounded-3xl flex items-center justify-center mb-6 shadow-xl rotate-12 transition-transform hover:rotate-0">
          <span className="material-symbols-outlined text-background-dark text-4xl font-bold">payments</span>
        </div>
        <h1 className="text-3xl font-extrabold dark:text-white mb-2 italic">PAMBALA AO</h1>
        <p className="text-slate-500 text-sm font-medium mb-10 text-center">Gestão Inteligente para o Empreendedor Angolano</p>
        <button onClick={() => setIsAuthenticated(true)} className="w-full bg-primary text-background-dark font-black py-4 rounded-2xl shadow-lg active:scale-95">ACEDER AO SISTEMA</button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background-light dark:bg-background-dark shadow-2xl relative transition-colors">
      <Toast message={toast.message} show={toast.show} />

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        
        {view === 'home' && (
          <div className="animate-in p-4 space-y-6">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary"><span className="material-symbols-outlined">storefront</span></div>
                <div><h2 className="text-lg font-black dark:text-white leading-tight">{profile.storeName}</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{profile.address}</p></div>
              </div>
              <button onClick={() => setView('menu')} className="size-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center"><span className="material-symbols-outlined text-slate-400">menu</span></button>
            </header>

            <div className="bg-surface-dark rounded-3xl p-6 shadow-xl text-white relative overflow-hidden group">
               <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Caixa Geral</p>
               <h1 className="text-4xl font-black">Kz {transactions.reduce((a, b) => a + b.amount, 0).toLocaleString()}</h1>
               <div className="mt-6 flex gap-3 relative z-10">
                 <button onClick={() => setView('sales')} className="flex-1 bg-primary text-background-dark py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20">Vender</button>
                 <button onClick={() => setView('expenses')} className="flex-1 bg-white/10 backdrop-blur-md py-3 rounded-xl font-black text-xs uppercase">Gastos</button>
               </div>
            </div>

            <section className="grid grid-cols-2 gap-4">
               <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm" onClick={() => setView('clients')}>
                  <div className="flex items-center gap-2 mb-2"><span className="material-symbols-outlined text-blue-500 text-sm">stars</span><p className="text-[10px] font-black uppercase text-slate-400">Clientes</p></div>
                  <p className="text-xl font-black">{clients.length}</p>
               </div>
               <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm" onClick={() => setView('products')}>
                  <div className="flex items-center gap-2 mb-2"><span className="material-symbols-outlined text-orange-500 text-sm">inventory_2</span><p className="text-[10px] font-black uppercase text-slate-400">Stock</p></div>
                  <p className="text-xl font-black">{products.length}</p>
               </div>
            </section>
          </div>
        )}

        {view === 'products' && (
          <div className="animate-in p-4 space-y-4">
            <header className="flex justify-between items-center">
              <h1 className="text-2xl font-black">Stock Ativo</h1>
              <button onClick={startAddProduct} className="size-12 rounded-full bg-primary text-background-dark flex items-center justify-center shadow-lg active:scale-90"><span className="material-symbols-outlined">add</span></button>
            </header>
            <div className="space-y-3">
              {products.map(p => (
                <div key={p.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center gap-4 border border-slate-100 dark:border-slate-800 shadow-sm group">
                  <img src={p.image} className="size-16 rounded-xl object-cover bg-slate-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-black text-primary">Kz {p.salePrice.toLocaleString()}</span>
                      <span className={`text-[8px] px-2 py-0.5 rounded-full font-black ${p.stock > 5 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>Qtd: {p.stock}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => startEditProduct(p)} className="size-8 rounded-lg bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-500"><span className="material-symbols-outlined text-sm">edit</span></button>
                    <button onClick={() => deleteProduct(p.id)} className="size-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500"><span className="material-symbols-outlined text-sm">delete</span></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'productForm' && (
          <div className="animate-in p-4 space-y-6">
            <header className="flex items-center gap-4">
              <button onClick={() => setView('products')} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><span className="material-symbols-outlined">arrow_back</span></button>
              <h1 className="text-xl font-black">{editingProduct ? 'Editar Stock' : 'Novo Artigo'}</h1>
            </header>
            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl space-y-4 shadow-sm">
                <div><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Nome do Artigo</label><input required value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-sm" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Preço Venda</label><input required type="number" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-sm" /></div>
                  <div><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Quantidade</label><input required type="number" value={productForm.stock} onChange={e => setProductForm({...productForm, stock: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-sm" /></div>
                </div>
                <div><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Categoria</label><select value={productForm.cat} onChange={e => setProductForm({...productForm, cat: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-xs">{CATEGORIAS_PRODUTO.map(c => <option key={c}>{c}</option>)}</select></div>
              </div>
              <button type="submit" className="w-full bg-primary text-background-dark py-4 rounded-2xl font-black shadow-lg">SALVAR ALTERAÇÕES</button>
            </form>
          </div>
        )}

        {view === 'clients' && (
          <div className="animate-in p-4 space-y-4">
            <header className="flex justify-between items-center">
              <button onClick={() => setView('menu')} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><span className="material-symbols-outlined">arrow_back</span></button>
              <h1 className="text-2xl font-black">Clientes</h1>
              <button onClick={() => { setEditingClient(null); setClientForm({name:'', phone:'', email:'', category: 'Novo'}); setView('clientForm'); }} className="size-12 rounded-full bg-primary text-background-dark flex items-center justify-center shadow-lg"><span className="material-symbols-outlined">person_add</span></button>
            </header>
            <div className="space-y-3">
              {clients.map(c => (
                <div key={c.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center gap-4 border border-slate-100 dark:border-slate-800 shadow-sm relative group">
                  <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-black text-primary text-lg">{c.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate">{c.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-slate-400 font-bold">{c.phone}</p>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        c.category === 'VIP' ? 'bg-amber-100 text-amber-700' :
                        c.category === 'Fiel' ? 'bg-primary/20 text-primary-dark' :
                        c.category === 'Recorrente' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                      }`}>{c.category}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEditClient(c)} className="size-8 rounded-lg bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-500 active:scale-90"><span className="material-symbols-outlined text-sm">edit</span></button>
                    <button onClick={() => deleteClient(c.id)} className="size-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 active:scale-90"><span className="material-symbols-outlined text-sm">delete</span></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'clientForm' && (
          <div className="animate-in p-4 space-y-6">
            <header className="flex items-center gap-4">
              <button onClick={() => setView('clients')} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><span className="material-symbols-outlined">arrow_back</span></button>
              <h1 className="text-xl font-black">{editingClient ? 'Editar Perfil' : 'Novo Cliente'}</h1>
            </header>
            <form onSubmit={handleClientSubmit} className="space-y-4">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl space-y-4 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Nome Completo</label><input required value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-sm" /></div>
                <div><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Terminal / WhatsApp</label><input required value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-sm" /></div>
                <div><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Categoria de Fidelidade</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIAS_CLIENTE.map(cat => (
                      <button type="button" key={cat} onClick={() => setClientForm({...clientForm, category: cat})} className={`py-2 rounded-xl text-[10px] font-black border-2 transition-all ${clientForm.category === cat ? 'bg-primary border-primary text-background-dark' : 'border-slate-100 text-slate-400'}`}>{cat}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full bg-primary text-background-dark py-4 rounded-2xl font-black shadow-lg">SALVAR CLIENTE</button>
            </form>
          </div>
        )}

        {view === 'sales' && (
          <div className="animate-in p-4 space-y-6">
            <h1 className="text-2xl font-black">Vender Artigos</h1>
            <div className="space-y-3">
              {products.map(p => (
                <div key={p.id} onClick={() => {
                  const isSel = selectedProductIds.includes(p.id);
                  setSelectedProductIds(prev => isSel ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                  if (!isSel) setManualSale(prev => ({...prev, quantities: {...prev.quantities, [p.id]: 1}}));
                }} className={`p-4 rounded-2xl flex items-center gap-4 border-2 transition-all cursor-pointer ${selectedProductIds.includes(p.id) ? 'bg-primary/10 border-primary' : 'bg-white dark:bg-slate-800 border-transparent shadow-sm'}`}>
                  <div className={`size-6 rounded-md flex items-center justify-center border-2 ${selectedProductIds.includes(p.id) ? 'bg-primary border-primary' : 'border-slate-200'}`}>
                    {selectedProductIds.includes(p.id) && <span className="material-symbols-outlined text-background-dark text-sm font-bold">check</span>}
                  </div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-black truncate">{p.name}</p><p className="text-[10px] font-bold text-slate-400">Kz {p.salePrice.toLocaleString()}</p></div>
                  {selectedProductIds.includes(p.id) && (
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 rounded-lg p-1" onClick={e => e.stopPropagation()}>
                       <button onClick={() => setManualSale(prev => ({...prev, quantities: {...prev.quantities, [p.id]: Math.max(1, (prev.quantities[p.id] || 1) - 1)}}))} className="size-6 flex items-center justify-center font-black">-</button>
                       <span className="text-xs font-black w-4 text-center">{manualSale.quantities[p.id]}</span>
                       <button onClick={() => setManualSale(prev => ({...prev, quantities: {...prev.quantities, [p.id]: (prev.quantities[p.id] || 1) + 1}}))} className="size-6 flex items-center justify-center font-black">+</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button disabled={selectedProductIds.length === 0} onClick={() => setView('manualSaleDetails')} className="w-full bg-primary text-background-dark py-4 rounded-2xl font-black shadow-lg">CONTINUAR PARA ENTREGA</button>
          </div>
        )}

        {view === 'manualSaleDetails' && (
          <div className="animate-in p-4 space-y-6">
            <header className="flex items-center gap-4">
              <button onClick={() => setView('sales')} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><span className="material-symbols-outlined">arrow_back</span></button>
              <h1 className="text-xl font-black">Finalizar Venda</h1>
            </header>
            <form onSubmit={handleSaleSubmit} className="space-y-4">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl space-y-4 border shadow-sm">
                <div><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Cliente</label><input required value={manualSale.customerName} onChange={e => setManualSale({...manualSale, customerName: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-sm" placeholder="Nome do Cliente" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Local</label><select value={manualSale.deliveryLocation} onChange={e => setManualSale({...manualSale, deliveryLocation: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-xs">{MUNICIPAIS.map(m => <option key={m}>{m}</option>)}</select></div>
                  <div><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Gênero</label><select value={manualSale.customerGender} onChange={e => setManualSale({...manualSale, customerGender: e.target.value as Gender})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-xs"><option>Feminino</option><option>Masculino</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Desconto (Kz)</label><input type="number" value={manualSale.discount} onChange={e => setManualSale({...manualSale, discount: Number(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-sm text-green-600" /></div>
                  <div><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Hora</label><input type="time" value={manualSale.time} onChange={e => setManualSale({...manualSale, time: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-sm" /></div>
                </div>
              </div>
              <button type="submit" className="w-full bg-primary text-background-dark py-4 rounded-2xl font-black text-lg shadow-xl">CONCLUIR NEGÓCIO</button>
            </form>
          </div>
        )}

        {view === 'saleSuccess' && (
          <div className="animate-in p-8 text-center flex flex-col items-center justify-center min-h-[80vh]">
            <div className="size-24 bg-primary rounded-full flex items-center justify-center mb-6 shadow-2xl animate-bounce"><span className="material-symbols-outlined text-background-dark text-6xl">check_circle</span></div>
            <h1 className="text-2xl font-black mb-2 dark:text-white">Venda Concluída!</h1>
            <p className="text-slate-500 mb-8 italic">Seu Kwanza está seguro. Factura disponível.</p>
            <button onClick={() => lastSaleId && downloadInvoice(lastSaleId)} className="w-full bg-blue-500 text-white py-4 rounded-2xl font-black mb-3 flex items-center justify-center gap-2"><span className="material-symbols-outlined">download</span> BAIXAR FACTURA</button>
            <button onClick={() => setView('home')} className="w-full bg-slate-900 dark:bg-white dark:text-background-dark text-white py-4 rounded-2xl font-black">VOLTAR AO INÍCIO</button>
          </div>
        )}

        {view === 'menu' && (
          <div className="animate-in p-4 space-y-6">
            <h1 className="text-2xl font-black">Pambala Admin</h1>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'clients', label: 'Fidelidade', icon: 'stars', color: 'bg-amber-500' },
                { id: 'reports', label: 'Estatísticas', icon: 'analytics', color: 'bg-primary' },
                { id: 'profile', label: 'Meu Perfil', icon: 'account_circle', color: 'bg-blue-500' },
                { id: 'adjustments', label: 'Definições', icon: 'settings', color: 'bg-slate-500' },
              ].map(item => (
                <button key={item.id} onClick={() => setView(item.id as View)} className="bg-white dark:bg-slate-800 p-6 rounded-3xl flex flex-col items-center justify-center gap-3 shadow-sm active:scale-95 border border-slate-100 dark:border-slate-800">
                  <div className={`size-12 rounded-2xl ${item.color} text-white flex items-center justify-center shadow-lg`}><span className="material-symbols-outlined">{item.icon}</span></div>
                  <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      <Navigation activeView={view} setView={setView} />
    </div>
  );
};

export default App;
