
import React, { useState, useEffect, useMemo } from 'react';
import { View, Product, Client, Transaction, SaleItem, PaymentMethod, Gender } from './types';
import { INITIAL_PRODUCTS, INITIAL_CLIENTS, INITIAL_TRANSACTIONS } from './mockData';
import { generateProductDescription } from './geminiService';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts';

const MUNICIPAIS = ['Luanda', 'Belas', 'Cazenga', 'Cacuaco', 'Viana', 'Talatona', 'Kilamba Kiaxi', 'Icolo e Bengo', 'Quiçama'];
const CATEGORIAS = ['Vestuário', 'Calçados', 'Acessórios', 'Eletrônicos', 'Beleza'];

const Navigation: React.FC<{ activeView: View; setView: (v: View) => void }> = ({ activeView, setView }) => {
  const items: { id: View; icon: string; label: string }[] = [
    { id: 'home', icon: 'grid_view', label: 'Painel' },
    { id: 'sales', icon: 'shopping_cart', label: 'Vendas' },
    { id: 'products', icon: 'inventory_2', label: 'Estoque' },
    { id: 'clients', icon: 'group', label: 'Clientes' },
    { id: 'reports', icon: 'analytics', label: 'Relatórios' },
  ];

  return (
    <nav className="fixed bottom-0 z-40 w-full max-w-md mx-auto left-0 right-0 bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
      <div className="flex h-16 items-center justify-around px-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`group flex flex-1 flex-col items-center gap-1 p-2 transition-all ${
              (activeView === item.id || (activeView === 'manualSaleDetails' && item.id === 'sales')) ? 'text-primary scale-110' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
            }`}
          >
            <span className={`material-symbols-outlined text-[22px] ${(activeView === item.id || (activeView === 'manualSaleDetails' && item.id === 'sales')) ? 'filled' : ''}`} style={{ fontVariationSettings: (activeView === item.id || (activeView === 'manualSaleDetails' && item.id === 'sales')) ? "'FILL' 1" : "" }}>
              {item.icon}
            </span>
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

  // Estados da Venda Manual
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [manualSale, setManualSale] = useState({
    customerName: '',
    customerGender: 'Feminino' as Gender,
    paymentMethod: 'Dinheiro em Mão' as PaymentMethod,
    deliveryLocation: 'Luanda',
    discount: 0,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    quantities: {} as Record<string, number>,
    priceOverrides: {} as Record<string, number>
  });

  // Estados de Cadastro
  const [newProduct, setNewProduct] = useState({ name: '', cat: 'Vestuário', price: '', stock: '', sku: '', cost: '' });
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '' });
  const [iaDesc, setIaDesc] = useState('');
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);

  useEffect(() => {
    isDarkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  // --- Handlers ---

  const handleManualSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProductIds.length === 0) return showToast("Selecione os produtos primeiro!");

    let totalAmount = 0;
    const saleItems: SaleItem[] = selectedProductIds.map(id => {
      const p = products.find(x => x.id === id)!;
      const qty = manualSale.quantities[id] || 1;
      const price = manualSale.priceOverrides[id] || p.salePrice;
      totalAmount += price * qty;
      return { productId: id, quantity: qty, priceAtSale: price };
    });

    const finalAmount = totalAmount - manualSale.discount;

    const transaction: Transaction = {
      id: `SALE-${Date.now()}`,
      description: `Venda p/ ${manualSale.customerName || 'Cliente Final'}`,
      amount: finalAmount,
      date: manualSale.date,
      time: manualSale.time,
      category: 'Vendas',
      type: 'income',
      customerName: manualSale.customerName,
      customerGender: manualSale.customerGender,
      paymentMethod: manualSale.paymentMethod,
      deliveryLocation: manualSale.deliveryLocation,
      discount: manualSale.discount,
      items: saleItems
    };

    // Atualiza estoque
    setProducts(prev => prev.map(p => {
      const item = saleItems.find(si => si.productId === p.id);
      return item ? { ...p, stock: Math.max(0, p.stock - item.quantity) } : p;
    }));

    setTransactions(prev => [transaction, ...prev]);
    setView('saleSuccess');
    showToast("Venda registrada com sucesso!");
    
    // Reset form
    setSelectedProductIds([]);
    setManualSale({
      customerName: '', customerGender: 'Feminino', paymentMethod: 'Dinheiro em Mão',
      deliveryLocation: 'Luanda', discount: 0, date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      quantities: {}, priceOverrides: {}
    });
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const prod: Product = {
      id: `P${Date.now()}`,
      name: newProduct.name,
      sku: newProduct.sku || `SKU-${Math.floor(Math.random() * 1000)}`,
      category: newProduct.cat,
      costPrice: Number(newProduct.cost),
      salePrice: Number(newProduct.price),
      stock: Number(newProduct.stock),
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=200&auto=format&fit=crop',
      description: iaDesc
    };
    setProducts(prev => [prod, ...prev]);
    setNewProduct({ name: '', cat: 'Vestuário', price: '', stock: '', sku: '', cost: '' });
    setIaDesc('');
    setView('products');
    showToast("Produto cadastrado!");
  };

  // --- Insights do BI ---

  const reportData = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income');
    
    // Categorias
    const catCounts: Record<string, number> = {};
    income.forEach(t => {
      t.items?.forEach(item => {
        const p = products.find(x => x.id === item.productId);
        if (p) catCounts[p.category] = (catCounts[p.category] || 0) + item.quantity;
      });
    });
    const categories = Object.entries(catCounts).map(([name, value]) => ({ name, value }));

    // Municípios
    const locCounts: Record<string, number> = {};
    income.forEach(t => {
      if (t.deliveryLocation) locCounts[t.deliveryLocation] = (locCounts[t.deliveryLocation] || 0) + t.amount;
    });
    const locations = Object.entries(locCounts).map(([name, value]) => ({ name, value }));

    // Produtos mais vendidos
    const prodCounts: Record<string, number> = {};
    income.forEach(t => {
      t.items?.forEach(item => {
        const p = products.find(x => x.id === item.productId);
        if (p) prodCounts[p.name] = (prodCounts[p.name] || 0) + item.quantity;
      });
    });
    const topProducts = Object.entries(prodCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Gênero
    const genders = [
      { name: 'Feminino', value: income.filter(t => t.customerGender === 'Feminino').length },
      { name: 'Masculino', value: income.filter(t => t.customerGender === 'Masculino').length },
      { name: 'Outro', value: income.filter(t => t.customerGender === 'Outro').length }
    ];

    return { categories, locations, topProducts, genders };
  }, [transactions, products]);

  // --- Views ---

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background-light dark:bg-background-dark p-8 justify-center items-center text-center">
        <div className="size-20 bg-primary rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-primary/20 rotate-12 transition-transform hover:rotate-0">
          <span className="material-symbols-outlined text-background-dark text-4xl font-bold">account_balance_wallet</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 italic">PAMBALA AO</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-10 text-sm font-medium">Controle total do seu Kwanza</p>
        <form onSubmit={(e) => { e.preventDefault(); setIsAuthenticated(true); }} className="w-full space-y-4 text-left">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Login de Acesso</label>
            <input type="email" required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-primary transition-all" placeholder="vendedor@pambala.ao" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Senha Segura</label>
            <input type="password" required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-primary transition-all" placeholder="••••••••" />
          </div>
          <button type="submit" className="w-full bg-primary text-background-dark font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all mt-4">ACESSAR PAINEL</button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden relative transition-colors">
      <Toast message={toast.message} show={toast.show} />

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        
        {view === 'home' && (
          <div className="animate-in p-4 space-y-6">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary"><span className="material-symbols-outlined">analytics</span></div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bom dia,</span>
                  <h2 className="text-lg font-black dark:text-white leading-tight">Admin Pambala</h2>
                </div>
              </div>
              <button onClick={() => setView('adjustments')} className="size-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center active:scale-90 transition-all">
                <span className="material-symbols-outlined text-slate-400">tune</span>
              </button>
            </header>

            <div className="bg-surface-dark rounded-3xl p-6 shadow-xl text-white relative overflow-hidden group">
               <div className="absolute -top-10 -right-10 size-40 bg-primary/20 rounded-full blur-3xl group-hover:scale-125 transition-transform" />
               <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Caixa Acumulado</p>
               <h1 className="text-4xl font-black">Kz {transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0).toLocaleString('pt-BR')}</h1>
               <div className="mt-6 flex gap-3 relative z-10">
                 <button onClick={() => setView('sales')} className="flex-1 bg-primary text-background-dark py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 active:scale-95">Nova Venda</button>
                 <button onClick={() => setView('reports')} className="flex-1 bg-white/10 backdrop-blur-md py-3 rounded-xl font-black text-xs uppercase active:scale-95">Insights</button>
               </div>
            </div>

            <section>
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-sm font-black uppercase text-slate-500">Fluxo Recente</h3>
                <button className="text-[10px] font-black text-primary uppercase">Ver Tudo</button>
              </div>
              <div className="space-y-3">
                {transactions.slice(0, 5).map(t => (
                  <div key={t.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-sm border border-slate-50 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className={`size-10 rounded-xl flex items-center justify-center ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        <span className="material-symbols-outlined">{t.type === 'income' ? 'shopping_bag' : 'receipt_long'}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate max-w-[140px]">{t.description}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{t.date} • {t.deliveryLocation || 'Balcão'}</p>
                      </div>
                    </div>
                    <p className={`font-black text-sm ${t.type === 'income' ? 'text-green-600' : 'text-slate-900 dark:text-white'}`}>
                      {t.type === 'income' ? '+' : '-'} {t.amount.toLocaleString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === 'sales' && (
          <div className="animate-in p-4 space-y-6">
            <header>
              <h1 className="text-2xl font-black">Registrar Venda</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Passo 1: Checklist de Produtos</p>
            </header>

            <div className="space-y-3">
              {products.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => {
                    const isSel = selectedProductIds.includes(p.id);
                    setSelectedProductIds(prev => isSel ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                    if (!isSel && !manualSale.quantities[p.id]) {
                      setManualSale(prev => ({...prev, quantities: {...prev.quantities, [p.id]: 1}}));
                    }
                  }}
                  className={`p-4 rounded-2xl flex items-center gap-4 border-2 transition-all cursor-pointer ${selectedProductIds.includes(p.id) ? 'bg-primary/10 border-primary' : 'bg-white dark:bg-slate-800 border-transparent shadow-sm'}`}
                >
                  <div className={`size-6 rounded-md flex items-center justify-center border-2 transition-colors ${selectedProductIds.includes(p.id) ? 'bg-primary border-primary' : 'border-slate-200'}`}>
                    {selectedProductIds.includes(p.id) && <span className="material-symbols-outlined text-background-dark text-sm font-bold">check</span>}
                  </div>
                  <img src={p.image} className="size-14 rounded-xl object-cover bg-slate-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate">{p.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{p.category} • Kz {p.salePrice.toLocaleString()}</p>
                    <p className="text-[9px] font-black text-primary uppercase mt-0.5">Stock: {p.stock} un.</p>
                  </div>
                  {selectedProductIds.includes(p.id) && (
                    <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-900 rounded-lg p-1" onClick={e => e.stopPropagation()}>
                       <button onClick={() => setManualSale(prev => ({...prev, quantities: {...prev.quantities, [p.id]: Math.max(1, (prev.quantities[p.id] || 1) - 1)}}))} className="size-6 flex items-center justify-center font-black">-</button>
                       <span className="text-xs font-black min-w-[16px] text-center">{manualSale.quantities[p.id] || 1}</span>
                       <button onClick={() => setManualSale(prev => ({...prev, quantities: {...prev.quantities, [p.id]: (prev.quantities[p.id] || 1) + 1}}))} className="size-6 flex items-center justify-center font-black">+</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button 
              disabled={selectedProductIds.length === 0}
              onClick={() => setView('manualSaleDetails')}
              className="w-full bg-primary text-background-dark py-4 rounded-2xl font-black text-lg flex justify-between px-6 shadow-xl shadow-primary/20 disabled:opacity-30 active:scale-95 transition-all sticky bottom-4 z-20"
            >
              <span>CONTINUAR</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        )}

        {view === 'manualSaleDetails' && (
          <div className="animate-in p-4 space-y-6 pb-32">
            <header className="flex items-center gap-4">
              <button onClick={() => setView('sales')} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-90 transition-all"><span className="material-symbols-outlined">arrow_back</span></button>
              <div>
                <h1 className="text-xl font-black">Detalhes da Venda</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Preencha os dados manuais</p>
              </div>
            </header>

            <form onSubmit={handleManualSaleSubmit} className="space-y-4">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl space-y-4 shadow-sm border border-slate-100 dark:border-slate-800">
                <section className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-primary/20 pb-1">Cliente & Demografia</h3>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Nome Completo</label>
                    <input required value={manualSale.customerName} onChange={e => setManualSale({...manualSale, customerName: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-sm" placeholder="Ex: Lucas Kimbundu" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Gênero</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Masculino', 'Feminino', 'Outro'].map(g => (
                        <button type="button" key={g} onClick={() => setManualSale({...manualSale, customerGender: g as Gender})} className={`py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${manualSale.customerGender === g ? 'bg-primary border-primary text-background-dark' : 'border-slate-100 dark:border-slate-700 text-slate-400'}`}>{g}</button>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="space-y-4 pt-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-primary/20 pb-1">Logística & Pagamento</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Município</label>
                      <select value={manualSale.deliveryLocation} onChange={e => setManualSale({...manualSale, deliveryLocation: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-xs appearance-none">
                        {MUNICIPAIS.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Método</label>
                      <select value={manualSale.paymentMethod} onChange={e => setManualSale({...manualSale, paymentMethod: e.target.value as PaymentMethod})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-xs appearance-none">
                        <option>Dinheiro em Mão</option>
                        <option>Transferência</option>
                        <option>Depósito</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Desconto (Kz)</label>
                      <input type="number" value={manualSale.discount} onChange={e => setManualSale({...manualSale, discount: Number(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-sm" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Data da Venda</label>
                      <input type="date" value={manualSale.date} onChange={e => setManualSale({...manualSale, date: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-xs" />
                    </div>
                  </div>
                </section>

                <section className="space-y-4 pt-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-primary/20 pb-1">Resumo dos Itens</h3>
                  <div className="space-y-2">
                    {selectedProductIds.map(id => {
                      const p = products.find(x => x.id === id);
                      return (
                        <div key={id} className="flex items-center justify-between text-xs p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                           <span className="font-bold">{p?.name} (x{manualSale.quantities[id] || 1})</span>
                           <span className="font-black">Kz {((manualSale.priceOverrides[id] || p?.salePrice || 0) * (manualSale.quantities[id] || 1)).toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-30">
                <button type="submit" className="w-full bg-primary text-background-dark py-5 rounded-2xl font-black text-lg flex justify-between px-8 shadow-2xl shadow-primary/40 active:scale-95 transition-all">
                   <div className="text-left">
                     <p className="text-[9px] uppercase opacity-60 leading-none mb-1">Total Final</p>
                     <p>Kz {(selectedProductIds.reduce((a, b) => a + (manualSale.priceOverrides[b] || products.find(p => p.id === b)?.salePrice || 0) * (manualSale.quantities[b] || 1), 0) - manualSale.discount).toLocaleString('pt-BR')}</p>
                   </div>
                   <div className="flex items-center gap-2">
                     FINALIZAR <span className="material-symbols-outlined">task_alt</span>
                   </div>
                </button>
              </div>
            </form>
          </div>
        )}

        {view === 'reports' && (
          <div className="animate-in p-4 space-y-6 pb-20">
            <h1 className="text-2xl font-black">Inteligência Pambala</h1>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary/10 p-4 rounded-2xl">
                <p className="text-[10px] font-black text-primary uppercase">Conversão Média</p>
                <p className="text-xl font-black">Kz 14.500</p>
              </div>
              <div className="bg-blue-500/10 p-4 rounded-2xl">
                <p className="text-[10px] font-black text-blue-500 uppercase">Total Items Vendidos</p>
                <p className="text-xl font-black">{transactions.filter(t => t.type === 'income').reduce((a, b) => a + (b.items?.length || 0), 0)}</p>
              </div>
            </div>

            {/* Top Produtos */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
               <h3 className="text-xs font-black uppercase text-slate-500 mb-6 flex items-center gap-2">
                 <span className="material-symbols-outlined text-sm">trending_up</span> Produtos Mais Vendidos
               </h3>
               <div className="h-48 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={reportData.topProducts} layout="vertical">
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.1} />
                     <XAxis type="number" hide />
                     <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} width={90} />
                     <Tooltip contentStyle={{borderRadius: '12px', border: 'none'}} />
                     <Bar dataKey="value" fill="#13ec80" radius={[0, 4, 4, 0]} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            {/* Market Share Municípios */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
               <h3 className="text-xs font-black uppercase text-slate-500 mb-6 flex items-center gap-2">
                 <span className="material-symbols-outlined text-sm">map</span> Vendas por Município (Valor Kz)
               </h3>
               <div className="h-48 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.locations}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                      <YAxis hide />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            {/* Demografia e Categorias */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                 <h3 className="text-[9px] font-black uppercase text-slate-500 mb-4 text-center">Gênero</h3>
                 <div className="h-32 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie data={reportData.genders} dataKey="value" cx="50%" cy="50%" innerRadius={20} outerRadius={35}>
                         <Cell fill="#f472b6" />
                         <Cell fill="#3b82f6" />
                         <Cell fill="#fbbf24" />
                       </Pie>
                       <Tooltip />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                 <h3 className="text-[9px] font-black uppercase text-slate-500 mb-4 text-center">Categorias</h3>
                 <div className="h-32 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie data={reportData.categories} dataKey="value" cx="50%" cy="50%" outerRadius={35}>
                         {reportData.categories.map((_, i) => <Cell key={i} fill={['#13ec80', '#3b82f6', '#f97316', '#a855f7'][i % 4]} />)}
                       </Pie>
                       <Tooltip />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Outras Views (Products, Clients, Forms) --- */}
        
        {view === 'products' && (
          <div className="animate-in p-4 space-y-4">
            <header className="flex justify-between items-center">
              <h1 className="text-2xl font-black">Stock Ativo</h1>
              <button onClick={() => setView('productForm')} className="size-12 rounded-full bg-primary text-background-dark flex items-center justify-center shadow-lg active:scale-90 transition-all"><span className="material-symbols-outlined">add</span></button>
            </header>
            <div className="space-y-3">
              {products.map(p => (
                <div key={p.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center gap-4 border border-slate-50 dark:border-slate-800 shadow-sm">
                  <img src={p.image} className="size-16 rounded-xl object-cover bg-slate-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate">{p.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{p.category} • SKU: {p.sku}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-black text-primary">Kz {p.salePrice.toLocaleString()}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${p.stock > 5 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>Qtd: {p.stock}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'productForm' && (
          <div className="animate-in p-4 space-y-6">
            <button onClick={() => setView('products')} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-90"><span className="material-symbols-outlined">arrow_back</span></button>
            <h1 className="text-2xl font-black">Novo Produto</h1>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <input required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold" placeholder="Nome do Produto" />
              <div className="grid grid-cols-2 gap-3">
                <select value={newProduct.cat} onChange={e => setNewProduct({...newProduct, cat: e.target.value})} className="bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold appearance-none">
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
                <input required type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold" placeholder="Preço Venda (Kz)" />
              </div>
              <input required type="number" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold" placeholder="Qtd. em Stock" />
              <div>
                <button type="button" onClick={async () => {
                  if(!newProduct.name) return showToast("Dê um nome ao produto!");
                  setIsGeneratingIA(true);
                  const desc = await generateProductDescription(newProduct.name, newProduct.cat);
                  setIaDesc(desc);
                  setIsGeneratingIA(false);
                }} disabled={isGeneratingIA} className="text-[10px] font-black text-primary uppercase flex items-center gap-1 mb-2 hover:opacity-80">
                  <span className="material-symbols-outlined text-sm">auto_awesome</span> {isGeneratingIA ? 'Magia acontecendo...' : 'Gerar descrição com IA'}
                </button>
                <textarea value={iaDesc} onChange={e => setIaDesc(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-medium text-sm h-28 resize-none" placeholder="Descrição do produto..." />
              </div>
              <button type="submit" className="w-full bg-primary text-background-dark py-4 rounded-2xl font-black shadow-lg shadow-primary/20 active:scale-95 transition-all">SALVAR NO STOCK</button>
            </form>
          </div>
        )}

        {view === 'clients' && (
          <div className="animate-in p-4 space-y-4">
            <header className="flex justify-between items-center">
              <h1 className="text-2xl font-black">Meus Clientes</h1>
              <button onClick={() => setView('clientForm')} className="size-12 rounded-full bg-primary text-background-dark flex items-center justify-center shadow-lg active:scale-90 transition-all"><span className="material-symbols-outlined">person_add</span></button>
            </header>
            <div className="space-y-3">
              {clients.map(c => (
                <div key={c.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center gap-4 border border-slate-50 dark:border-slate-800 shadow-sm">
                  <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-black text-primary text-lg">{c.name.charAt(0)}</div>
                  <div className="flex-1">
                    <p className="text-sm font-black">{c.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{c.phone} • {c.lastPurchase || 'Nenhuma compra'}</p>
                  </div>
                  <div className={`size-2 rounded-full ${c.status === 'active' ? 'bg-primary' : 'bg-slate-300'}`} />
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'clientForm' && (
          <div className="animate-in p-4 space-y-6">
             <button onClick={() => setView('clients')} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-90"><span className="material-symbols-outlined">arrow_back</span></button>
             <h1 className="text-2xl font-black">Novo Cliente</h1>
             <form onSubmit={(e) => {
               e.preventDefault();
               const cli: Client = {
                 id: `C${Date.now()}`,
                 name: newClient.name,
                 phone: newClient.phone,
                 email: newClient.email,
                 status: 'active'
               };
               setClients(prev => [cli, ...prev]);
               setNewClient({name:'', phone:'', email:''});
               setView('clients');
               showToast("Cliente adicionado!");
             }} className="space-y-4">
                <input required value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold" placeholder="Nome Completo" />
                <input required value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold" placeholder="Telefone / WhatsApp" />
                <input value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold" placeholder="E-mail (Opcional)" />
                <button type="submit" className="w-full bg-primary text-background-dark py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all">REGISTRAR CLIENTE</button>
             </form>
          </div>
        )}

        {view === 'saleSuccess' && (
          <div className="animate-in p-8 text-center flex flex-col items-center justify-center min-h-[80vh]">
            <div className="size-24 bg-primary rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-primary/30 animate-bounce">
              <span className="material-symbols-outlined text-background-dark text-6xl">check_circle</span>
            </div>
            <h1 className="text-2xl font-black mb-2 dark:text-white">Venda Registrada!</h1>
            <p className="text-slate-500 mb-8 font-medium italic">"Negócio fechado, Kwanza no bolso!"</p>
            <button onClick={() => setView('home')} className="w-full bg-slate-900 dark:bg-slate-100 dark:text-background-dark text-white py-4 rounded-2xl font-black mb-3 active:scale-95 transition-all">VOLTAR AO PAINEL</button>
            <button onClick={() => setView('sales')} className="w-full border-2 border-slate-200 dark:border-slate-800 dark:text-white py-4 rounded-2xl font-black active:scale-95 transition-all">NOVA VENDA</button>
          </div>
        )}

        {view === 'adjustments' && (
          <div className="animate-in p-4 space-y-6">
            <h1 className="text-2xl font-black">Ajustes</h1>
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
               <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setIsDarkMode(!isDarkMode)}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">dark_mode</span>
                    <p className="font-bold dark:text-white">Tema Escuro</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors relative ${isDarkMode ? 'bg-primary' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 size-4 bg-white rounded-full transition-all ${isDarkMode ? 'right-1' : 'left-1'}`} />
                  </div>
               </div>
               <div className="h-px bg-slate-50 dark:bg-slate-700 mx-4" />
               <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setIsAuthenticated(false)}>
                  <div className="flex items-center gap-3 text-red-500 font-bold">
                    <span className="material-symbols-outlined">logout</span>
                    <p>Terminar Sessão</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-300">chevron_right</span>
               </div>
            </div>
            <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest pt-10 opacity-30">Pambala AO • Edição Angola 2025</p>
          </div>
        )}

      </div>

      <Navigation activeView={view} setView={setView} />
    </div>
  );
};

export default App;
