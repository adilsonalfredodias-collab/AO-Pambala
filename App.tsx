
import React, { useState, useEffect, useMemo } from 'react';
import { View, Product, Client, Transaction, SaleItem, PaymentMethod, Gender } from './types';
import { INITIAL_PRODUCTS, INITIAL_CLIENTS, INITIAL_TRANSACTIONS } from './mockData';
import { generateProductDescription } from './geminiService';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';

// Municípios para o seletor (Exemplo de Luanda)
const MUNICIPAIS = ['Luanda', 'Belas', 'Cazenga', 'Cacuaco', 'Viana', 'Talatona', 'Kilamba Kiaxi', 'Icolo e Bengo', 'Quiçama'];

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
              activeView === item.id ? 'text-primary scale-110' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
            }`}
          >
            <span className={`material-symbols-outlined text-[22px] ${activeView === item.id || (activeView === 'manualSaleDetails' && item.id === 'sales') ? 'filled text-primary' : ''}`}>
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
    quantities: {} as Record<string, number>
  });

  // Estado de Cadastro de Produto
  const [newProduct, setNewProduct] = useState({ name: '', cat: 'Vestuário', price: '', stock: '', sku: '', cost: '' });
  const [iaDesc, setIaDesc] = useState('');
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);

  useEffect(() => {
    isDarkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  // --- Lógica de Vendas ---

  const toggleProductSelection = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
    if (!manualSale.quantities[id]) {
      setManualSale(prev => ({
        ...prev,
        quantities: { ...prev.quantities, [id]: 1 }
      }));
    }
  };

  const handleManualSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProductIds.length === 0) return showToast("Selecione ao menos um produto!");

    let totalAmount = 0;
    const saleItems: SaleItem[] = selectedProductIds.map(id => {
      const p = products.find(x => x.id === id)!;
      const qty = manualSale.quantities[id] || 1;
      totalAmount += p.salePrice * qty;
      return { productId: id, quantity: qty, priceAtSale: p.salePrice };
    });

    const finalAmount = totalAmount - manualSale.discount;

    const newTransaction: Transaction = {
      id: `SALE-${Date.now()}`,
      description: `Venda para ${manualSale.customerName || 'Cliente Final'}`,
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

    // Atualizar Estoque
    setProducts(prev => prev.map(p => {
      const item = saleItems.find(si => si.productId === p.id);
      return item ? { ...p, stock: p.stock - item.quantity } : p;
    }));

    setTransactions(prev => [newTransaction, ...prev]);
    setSelectedProductIds([]);
    setManualSale({
      customerName: '',
      customerGender: 'Feminino',
      paymentMethod: 'Dinheiro em Mão',
      deliveryLocation: 'Luanda',
      discount: 0,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      quantities: {}
    });
    setView('saleSuccess');
  };

  // --- Insights para Relatórios ---
  
  const reportInsights = useMemo(() => {
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    
    // Produtos mais vendidos
    const productCounts: Record<string, number> = {};
    incomeTransactions.forEach(t => {
      t.items?.forEach(item => {
        const p = products.find(x => x.id === item.productId);
        if (p) productCounts[p.name] = (productCounts[p.name] || 0) + item.quantity;
      });
    });
    const topProducts = Object.entries(productCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Vendas por Município
    const locationCounts: Record<string, number> = {};
    incomeTransactions.forEach(t => {
      if (t.deliveryLocation) locationCounts[t.deliveryLocation] = (locationCounts[t.deliveryLocation] || 0) + t.amount;
    });
    const topLocations = Object.entries(locationCounts).map(([name, value]) => ({ name, value }));

    // Gênero
    const genderCounts: Record<string, number> = { 'Masculino': 0, 'Feminino': 0, 'Outro': 0 };
    incomeTransactions.forEach(t => {
      if (t.customerGender) genderCounts[t.customerGender]++;
    });
    const genderData = Object.entries(genderCounts).map(([name, value]) => ({ name, value }));

    return { topProducts, topLocations, genderData };
  }, [transactions, products]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background-light dark:bg-background-dark p-8 justify-center items-center">
        <div className="size-20 bg-primary rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-primary/20 rotate-12">
          <span className="material-symbols-outlined text-background-dark text-4xl font-bold">payments</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 italic">PAMBALA AO</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-10 text-sm font-medium">Gestão de Negócios Luanda</p>
        <form onSubmit={(e) => { e.preventDefault(); setIsAuthenticated(true); }} className="w-full space-y-4">
          <input type="email" required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl py-4 px-6 font-bold" placeholder="E-mail" />
          <input type="password" required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl py-4 px-6 font-bold" placeholder="Senha" />
          <button type="submit" className="w-full bg-primary text-background-dark font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all">ENTRAR</button>
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
                <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary"><span className="material-symbols-outlined">storefront</span></div>
                <h2 className="text-lg font-black dark:text-white">Pambala Store</h2>
              </div>
              <button onClick={() => setView('adjustments')} className="size-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center active:scale-95 transition-all">
                <span className="material-symbols-outlined text-slate-400">tune</span>
              </button>
            </header>

            <div className="bg-surface-dark rounded-3xl p-6 shadow-xl text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10"><span className="material-symbols-outlined text-6xl">monetization_on</span></div>
               <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Faturamento Geral</p>
               <h1 className="text-4xl font-black">Kz {transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0).toLocaleString('pt-BR')}</h1>
               <div className="mt-6 flex gap-3">
                 <button onClick={() => setView('sales')} className="flex-1 bg-primary text-background-dark py-3 rounded-xl font-black text-xs uppercase active:scale-95 transition-transform">Nova Venda</button>
                 <button onClick={() => setView('reports')} className="flex-1 bg-white/10 py-3 rounded-xl font-black text-xs uppercase active:scale-95">Relatórios</button>
               </div>
            </div>

            <section>
              <h3 className="text-sm font-black uppercase text-slate-500 mb-4 px-1">Atividade Recente</h3>
              <div className="space-y-3">
                {transactions.length === 0 ? (
                  <div className="text-center py-10 opacity-30">Nenhuma venda registrada ainda.</div>
                ) : (
                  transactions.slice(0, 5).map(t => (
                    <div key={t.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={`size-10 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          <span className="material-symbols-outlined">{t.type === 'income' ? 'shopping_bag' : 'receipt'}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold truncate max-w-[150px]">{t.description}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{t.date} • {t.deliveryLocation || 'Balcão'}</p>
                        </div>
                      </div>
                      <p className="font-black text-slate-900 dark:text-white">Kz {t.amount}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {view === 'sales' && (
          <div className="animate-in p-4 space-y-6">
            <header>
              <h1 className="text-2xl font-black">Registrar Venda</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Passo 1: Selecione os Produtos</p>
            </header>

            <div className="space-y-3">
              {products.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => toggleProductSelection(p.id)}
                  className={`p-4 rounded-2xl flex items-center gap-4 border transition-all cursor-pointer ${selectedProductIds.includes(p.id) ? 'bg-primary/10 border-primary' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800'}`}
                >
                  <div className={`size-6 rounded-md flex items-center justify-center border-2 ${selectedProductIds.includes(p.id) ? 'bg-primary border-primary' : 'border-slate-200'}`}>
                    {selectedProductIds.includes(p.id) && <span className="material-symbols-outlined text-background-dark text-sm font-bold">check</span>}
                  </div>
                  <img src={p.image} className="size-12 rounded-lg object-cover" />
                  <div className="flex-1">
                    <p className="text-sm font-black">{p.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{p.category} • Kz {p.salePrice}</p>
                  </div>
                  {selectedProductIds.includes(p.id) && (
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg" onClick={e => e.stopPropagation()}>
                       <button onClick={() => setManualSale(prev => ({...prev, quantities: {...prev.quantities, [p.id]: Math.max(1, (prev.quantities[p.id] || 1) - 1)}}))} className="size-6 flex items-center justify-center font-bold">-</button>
                       <span className="text-xs font-black w-4 text-center">{manualSale.quantities[p.id] || 1}</span>
                       <button onClick={() => setManualSale(prev => ({...prev, quantities: {...prev.quantities, [p.id]: (prev.quantities[p.id] || 1) + 1}}))} className="size-6 flex items-center justify-center font-bold">+</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button 
              disabled={selectedProductIds.length === 0}
              onClick={() => setView('manualSaleDetails')}
              className="w-full bg-primary text-background-dark py-4 rounded-2xl font-black text-lg flex justify-between px-6 shadow-xl shadow-primary/20 disabled:opacity-30 active:scale-95 transition-all"
            >
              <span>PRÓXIMO PASSO</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        )}

        {view === 'manualSaleDetails' && (
          <div className="animate-in p-4 space-y-6 pb-20">
            <header className="flex items-center gap-4">
              <button onClick={() => setView('sales')} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><span className="material-symbols-outlined">arrow_back</span></button>
              <div>
                <h1 className="text-xl font-black">Detalhes da Venda</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Preencha os dados manuais</p>
              </div>
            </header>

            <form onSubmit={handleManualSaleSubmit} className="space-y-4">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl space-y-4 shadow-sm border border-slate-100 dark:border-slate-800">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Nome do Cliente</label>
                  <input required value={manualSale.customerName} onChange={e => setManualSale({...manualSale, customerName: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-sm" placeholder="Ex: João Baptista" />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Gênero</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Masculino', 'Feminino', 'Outro'].map(g => (
                      <button type="button" key={g} onClick={() => setManualSale({...manualSale, customerGender: g as Gender})} className={`py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${manualSale.customerGender === g ? 'bg-primary border-primary text-background-dark' : 'border-slate-200 text-slate-400'}`}>{g}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Local de Entrega / Município</label>
                  <select value={manualSale.deliveryLocation} onChange={e => setManualSale({...manualSale, deliveryLocation: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-sm appearance-none">
                    {MUNICIPAIS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Método de Pagamento</label>
                  <select value={manualSale.paymentMethod} onChange={e => setManualSale({...manualSale, paymentMethod: e.target.value as PaymentMethod})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-sm appearance-none">
                    <option>Dinheiro em Mão</option>
                    <option>Transferência</option>
                    <option>Depósito</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Desconto (Kz)</label>
                    <input type="number" value={manualSale.discount} onChange={e => setManualSale({...manualSale, discount: Number(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Data</label>
                    <input type="date" value={manualSale.date} onChange={e => setManualSale({...manualSale, date: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold text-xs" />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-primary/10 rounded-2xl flex justify-between items-center">
                 <div>
                    <p className="text-[10px] font-black text-primary uppercase">Total a Pagar</p>
                    <h3 className="text-xl font-black">Kz {(selectedProductIds.reduce((a, b) => a + (products.find(p => p.id === b)?.salePrice || 0) * (manualSale.quantities[b] || 1), 0) - manualSale.discount).toLocaleString('pt-BR')}</h3>
                 </div>
                 <button type="submit" className="bg-primary text-background-dark size-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"><span className="material-symbols-outlined">done_all</span></button>
              </div>
            </form>
          </div>
        )}

        {view === 'saleSuccess' && (
          <div className="animate-in p-8 text-center flex flex-col items-center justify-center min-h-[80vh]">
            <div className="size-24 bg-primary rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-primary/30">
              <span className="material-symbols-outlined text-background-dark text-6xl">verified</span>
            </div>
            <h1 className="text-2xl font-black mb-2">Venda Registrada!</h1>
            <p className="text-slate-500 mb-8 font-medium italic">"Kwanza na mão, negócio no chão!"</p>
            <button onClick={() => setView('home')} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black mb-3 active:scale-95 transition-all">VOLTAR AO PAINEL</button>
            <button onClick={() => setView('sales')} className="w-full border-2 border-slate-200 dark:border-slate-800 py-4 rounded-2xl font-black active:scale-95 transition-all">NOVA VENDA</button>
          </div>
        )}

        {view === 'reports' && (
          <div className="animate-in p-4 space-y-6 pb-20">
            <h1 className="text-2xl font-black">Inteligência de Vendas</h1>
            
            {/* Vendas por Município */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
               <h3 className="text-xs font-black uppercase text-slate-500 mb-6 flex items-center gap-2">
                 <span className="material-symbols-outlined text-sm">location_on</span> Vendas por Município (Kz)
               </h3>
               <div className="h-48 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={reportInsights.topLocations} layout="vertical">
                     <XAxis type="number" hide />
                     <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} width={80} />
                     <Tooltip contentStyle={{borderRadius: '12px', border: 'none'}} />
                     <Bar dataKey="value" fill="#13ec80" radius={[0, 4, 4, 0]} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            {/* Demografia por Gênero */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
               <h3 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2">
                 <span className="material-symbols-outlined text-sm">face</span> Perfil dos Clientes
               </h3>
               <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={reportInsights.genderData} dataKey="value" cx="50%" cy="50%" outerRadius={60} paddingAngle={5}>
                        <Cell fill="#3b82f6" />
                        <Cell fill="#f472b6" />
                        <Cell fill="#fbbf24" />
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Produtos Mais Vendidos */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
               <h3 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2">
                 <span className="material-symbols-outlined text-sm">stars</span> Produtos em Destaque (Unidades)
               </h3>
               <div className="space-y-4">
                  {reportInsights.topProducts.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4 italic">Sem dados suficientes.</p>
                  ) : (
                    reportInsights.topProducts.map((p, i) => (
                      <div key={p.name} className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <span className="size-5 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-[10px] font-black">{i+1}</span>
                            <p className="text-sm font-bold">{p.name}</p>
                         </div>
                         <p className="text-sm font-black text-primary">{p.value} un.</p>
                      </div>
                    ))
                  )}
               </div>
            </div>
          </div>
        )}

        {/* View: Estoque (Products) */}
        {view === 'products' && (
          <div className="animate-in p-4 space-y-4">
            <header className="flex justify-between items-center">
              <h1 className="text-2xl font-black">Estoque</h1>
              <button onClick={() => setView('productForm')} className="size-12 rounded-full bg-primary text-background-dark flex items-center justify-center shadow-lg"><span className="material-symbols-outlined">add</span></button>
            </header>
            <div className="space-y-3">
              {products.map(p => (
                <div key={p.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center gap-4 border border-slate-100 dark:border-slate-800 shadow-sm transition-transform active:scale-98">
                  <img src={p.image} className="size-16 rounded-xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate">{p.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{p.category} • SKU: {p.sku}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-black text-primary">Kz {p.salePrice}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.stock > 5 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>Qtd: {p.stock}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View: Product Form */}
        {view === 'productForm' && (
          <div className="animate-in p-4 space-y-6">
            <button onClick={() => setView('products')} className="size-10 rounded-full bg-slate-100 flex items-center justify-center"><span className="material-symbols-outlined">arrow_back</span></button>
            <h1 className="text-2xl font-black">Novo Produto</h1>
            <form onSubmit={(e) => {
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
              setView('products');
              showToast("Produto Adicionado!");
            }} className="space-y-4">
              <input required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold" placeholder="Nome do Produto" />
              <div className="grid grid-cols-2 gap-3">
                <input required type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold" placeholder="Preço Venda" />
                <input required type="number" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} className="bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold" placeholder="Estoque Inicial" />
              </div>
              <div>
                <button type="button" onClick={async () => {
                   if (!newProduct.name) return showToast("Dê um nome!");
                   setIsGeneratingIA(true);
                   const desc = await generateProductDescription(newProduct.name, newProduct.cat);
                   setIaDesc(desc);
                   setIsGeneratingIA(false);
                }} disabled={isGeneratingIA} className="text-[10px] font-black text-primary uppercase flex items-center gap-1 mb-2">
                  <span className="material-symbols-outlined text-sm">auto_awesome</span> {isGeneratingIA ? 'Gerando...' : 'Gerar descrição com IA'}
                </button>
                <textarea value={iaDesc} onChange={e => setIaDesc(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-medium text-sm h-32" placeholder="Descrição do produto..." />
              </div>
              <button type="submit" className="w-full bg-primary text-background-dark py-4 rounded-2xl font-black shadow-lg">SALVAR NO ESTOQUE</button>
            </form>
          </div>
        )}

        {/* View: Clients */}
        {view === 'clients' && (
          <div className="animate-in p-4 space-y-4">
            <header className="flex justify-between items-center">
              <h1 className="text-2xl font-black">Meus Clientes</h1>
              <button onClick={() => setView('clientForm')} className="size-12 rounded-full bg-primary text-background-dark flex items-center justify-center shadow-lg"><span className="material-symbols-outlined">person_add</span></button>
            </header>
            <div className="space-y-3">
              {clients.map(c => (
                <div key={c.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center gap-4 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-black text-primary">{c.name.charAt(0)}</div>
                  <div>
                    <p className="text-sm font-black">{c.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{c.phone}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View: Adjustments */}
        {view === 'adjustments' && (
          <div className="animate-in p-4 space-y-6">
            <h1 className="text-2xl font-black">Configurações</h1>
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
               <div className="p-4 flex items-center justify-between" onClick={() => setIsDarkMode(!isDarkMode)}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">dark_mode</span>
                    <p className="font-bold">Tema Escuro</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors relative ${isDarkMode ? 'bg-primary' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 size-4 bg-white rounded-full transition-all ${isDarkMode ? 'right-1' : 'left-1'}`} />
                  </div>
               </div>
               <div className="h-px bg-slate-50 dark:bg-slate-700 mx-4" />
               <div className="p-4 flex items-center justify-between" onClick={() => setIsAuthenticated(false)}>
                  <div className="flex items-center gap-3 text-red-500">
                    <span className="material-symbols-outlined">logout</span>
                    <p className="font-bold">Sair da Conta</p>
                  </div>
               </div>
            </div>
            <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest pt-10 opacity-30">Pambala AO • Edição Luanda 2025</p>
          </div>
        )}

      </div>

      <Navigation activeView={view} setView={setView} />
    </div>
  );
};

export default App;
