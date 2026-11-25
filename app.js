const CATEGORIES = {
  expense: ['Comida', 'Casa', 'Renta', 'Salidas', 'Transporte', 'Salud', 'Personales', 'Servicios', 'Otros'],
  income: ['Sueldo', 'Freelance', 'Ventas', 'Regalo', 'Inversiones', 'Otros'],
  investment: ['Inversiones', 'Ahorro', 'Retiro', 'Otros']
};
const COLORS = ['#d7e769', '#88c8c5', '#f7ad6b', '#b4a4e6', '#ea8d80', '#91c99a', '#80b2df'];
const ICONS = {Comida:'◒',Casa:'⌂',Renta:'⌂',Salidas:'☼',Transporte:'↔',Salud:'✚',Personales:'♙',Servicios:'⌁',Inversiones:'↗',Ahorro:'◎',Sueldo:'▦',Freelance:'✦',Ventas:'◇',Regalo:'♡',Otros:'•',Retiro:'◌'};
const STORE = 'claro-finanzas-v1';
const THEME_STORE = 'claro-theme';
const money = new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN', maximumFractionDigits:0});
const today = new Date();
const iso = d => { const date=new Date(d); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };
const monthKey = (date=today) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
const emptyState = {movements:[],budgets:[],goals:[],reminders:[],accounts:[],investments:[],recurringPlans:[],preferences:{reflectInvestments:true}};
let state = load();
let editingMovementId = null;
let editingInvestmentId = null;
let editingAccountId = null;
let editingBudgetId = null;
let editingGoalId = null;
let editingReminderId = null;
let editingOperationId = null;
let editingOperationInvestmentId = null;
let selectedPortfolioPointIndex = 0;
function load(){ try { const stored=JSON.parse(localStorage.getItem(STORE)); if(!stored)return structuredClone(emptyState);const loaded={...structuredClone(emptyState),...stored,preferences:{...emptyState.preferences,...stored.preferences}};loaded.investments=(loaded.investments||[]).map(investment=>({...investment,operations:investment.operations||[],durationValue:Number(investment.durationValue)||Number(investment.durationMonths)||12,durationUnit:investment.durationUnit||'month',interestCap:Number(investment.interestCap)||0,redirectInvestmentId:Number(investment.redirectInvestmentId)||null,annualFeeType:investment.annualFeeType||'percent',annualFeeAmount:Number(investment.annualFeeAmount)||0}));loaded.goals=(loaded.goals||[]).map(goal=>({...goal,linkType:goal.linkType||'none'}));return loaded; } catch { return structuredClone(emptyState); } }
function save(){ localStorage.setItem(STORE, JSON.stringify(state)); }
function id(){ return Date.now() + Math.floor(Math.random()*1000); }
function currentMovements(){ return state.movements.filter(m => m.date.startsWith(monthKey())); }
function amount(type){ return currentMovements().filter(m => m.type === type && !(type==='income'&&m.investmentId)).reduce((sum,m) => sum + Number(m.amount),0); }
function expensesFor(category){ return currentMovements().filter(m => m.type === 'expense' && m.category === category).reduce((sum,m)=>sum + Number(m.amount),0); }
function displayDate(value){ return new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short'}).format(new Date(`${value}T12:00:00`)); }
function escapeHtml(value){ const div=document.createElement('div'); div.textContent=value; return div.innerHTML; }
function addMonthsClamped(date,months){const result=new Date(date),day=result.getDate();result.setDate(1);result.setMonth(result.getMonth()+months);result.setDate(Math.min(day,new Date(result.getFullYear(),result.getMonth()+1,0).getDate()));return result;}
function investmentMaturity(investment){const date=new Date(`${investment.startDate}T12:00:00`),amount=Math.max(1,Number(investment.durationValue)||Number(investment.durationMonths)||12),unit=investment.durationUnit||'month';if(unit==='day')date.setDate(date.getDate()+amount);else{const total=amount*(unit==='year'?12:1),day=date.getDate();date.setDate(1);date.setMonth(date.getMonth()+total);date.setDate(Math.min(day,new Date(date.getFullYear(),date.getMonth()+1,0).getDate()));}return date;}
function durationLabel(investment){return `${Number(investment.durationValue)||Number(investment.durationMonths)||12} ${({day:'día(s)',month:'mes(es)',year:'año(s)'})[investment.durationUnit||'month']}`;}
function investmentPrincipal(investment){ return Math.max(0,Number(investment.capital||0)+(investment.operations||[]).reduce((total,operation)=>total+(operation.type==='contribution'?1:-1)*Number(operation.amount),0)); }
function investmentValue(investment,endDate,includeMonthlyContributions=false){
  const start=new Date(`${investment.startDate}T12:00:00`),requestedEnd=new Date(`${iso(endDate)}T12:00:00`),maturity=investmentMaturity(investment),end=requestedEnd>maturity?maturity:requestedEnd;
  if(Number.isNaN(start.getTime())||end<start)return 0;
  let balance=Number(investment.capital)||0,principalBalance=Number(investment.capital)||0;
  const operations=(investment.operations||[]).filter(op=>op.date>=investment.startDate&&op.date<=iso(today)).sort((a,b)=>a.date.localeCompare(b.date));
  const plannedByDate={};
  if(includeMonthlyContributions)investmentPlans().filter(plan=>Number(plan.investmentId)===Number(investment.id)).forEach(plan=>{let occurrence=new Date(`${plan.startDate}T12:00:00`),guard=0;while(occurrence<new Date(`${iso(today)}T12:00:00`)&&guard++<800)occurrence=nextOccurrence(occurrence,plan.frequency);while(occurrence<=end&&guard++<1600){const key=iso(occurrence);plannedByDate[key]=(plannedByDate[key]||0)+Number(plan.amount);occurrence=nextOccurrence(occurrence,plan.frequency);}});
  let operationIndex=0;
  const annualRate=Math.max(-.99,Number(investment.rate||0)/100),periods={daily:365,weekly:52,monthly:12,quarterly:4,yearly:1}[investment.frequency]||12;
  const periodRate=annualRate/periods,tax=Math.max(0,Number(investment.taxRate||0))/100,fee=Math.max(0,Number(investment.annualFee||0))/100,fixedFee=Math.max(0,Number(investment.annualFeeAmount||0));
  const initialDay=start.getDate(),initialMonth=start.getMonth();
  for(let date=new Date(start),elapsed=0;date<=end;date.setDate(date.getDate()+1),elapsed++){
    const key=iso(date);
    while(operationIndex<operations.length&&operations[operationIndex].date===key){const op=operations[operationIndex++],amount=Number(op.amount);balance+=op.type==='contribution'?amount:-amount;principalBalance=op.type==='contribution'?principalBalance+amount:Math.max(0,principalBalance-amount);}
    if(includeMonthlyContributions&&key>iso(today)&&date.getDate()===1){const planned=Number(investment.monthlyContribution||0),cap=Math.max(0,Number(investment.interestCap)||0),contribution=cap?Math.min(planned,Math.max(0,cap-principalBalance)):planned;balance+=contribution;principalBalance+=contribution;}
    if(plannedByDate[key]){const cap=Math.max(0,Number(investment.interestCap)||0),contribution=cap?Math.min(plannedByDate[key],Math.max(0,cap-principalBalance)):plannedByDate[key];balance+=contribution;principalBalance+=contribution;}
    if(elapsed>0){
      const dayInMonth=Math.min(initialDay,new Date(date.getFullYear(),date.getMonth()+1,0).getDate());
      const monthDistance=(date.getFullYear()-start.getFullYear())*12+date.getMonth()-initialMonth;
      const compound=investment.frequency==='daily'||(investment.frequency==='weekly'&&elapsed%7===0)||(investment.frequency==='monthly'&&date.getDate()===dayInMonth)||(investment.frequency==='quarterly'&&monthDistance>0&&monthDistance%3===0&&date.getDate()===dayInMonth)||(investment.frequency==='yearly'&&monthDistance>0&&monthDistance%12===0&&date.getDate()===dayInMonth);
      if(compound){const cap=Math.max(0,Number(investment.interestCap)||0),simpleAfterCap=cap>0&&investment.interestMode==='simple'&&principalBalance>=cap,interest=(simpleAfterCap?principalBalance:balance)*periodRate;balance+=interest-(investment.taxMode==='capital'?0:Math.max(0,interest)*tax);}
      balance-=investment.annualFeeType==='amount'?fixedFee/365:Math.max(0,balance)*fee/365;
      if(investment.taxMode==='capital')balance-=Math.max(0,balance)*tax/365;
    }
  }
  return Math.max(0,balance);
}
function investmentMetrics(investment){const principal=investmentPrincipal(investment),value=investmentValue(investment,today),gain=value-principal;return{principal,value,gain};}
function investmentName(investment){return `${investment.institution} · ${investment.product}`;}
function frequencyPeriods(frequency){return{daily:365,weekly:52,monthly:12,quarterly:4,yearly:1}[frequency]||12;}
function projectionSnapshots(dates){
  const records=state.investments.map(investment=>({investment,balance:investmentValue(investment,today),principal:investmentPrincipal(investment)}));
  const byId=new Map(records.map(record=>[Number(record.investment.id),record]));
  const planByDate={};
  const schedule=(sourceId,amount,date)=>{const key=iso(date);(planByDate[key]??=[]).push({sourceId:Number(sourceId),amount:Number(amount)});};
  for(const record of records){const investment=record.investment;const monthly=Number(investment.monthlyContribution||0);if(monthly>0){for(let date=addMonthsClamped(today,1);date<=dates.at(-1);date=addMonthsClamped(date,1))schedule(investment.id,monthly,date);}}
  for(const plan of investmentPlans()){let date=new Date(`${plan.startDate}T12:00:00`),guard=0;while(date<=today&&guard++<900)date=nextOccurrence(date,plan.frequency);while(date<=dates.at(-1)&&guard++<1800){schedule(plan.investmentId,plan.amount,date);date=nextOccurrence(date,plan.frequency);}}
  const snapshots=[];
  const snapshot=(date)=>({date,values:records.map(record=>Math.max(0,record.balance)),total:records.reduce((sum,record)=>sum+Math.max(0,record.balance),0)});
  let pointIndex=0;if(dates[0]&&iso(dates[0])===iso(today)){snapshots.push(snapshot(today));pointIndex=1;}
  const end=dates.at(-1);for(let date=new Date(today);date<end;date.setDate(date.getDate()+1)){
    const current=new Date(date);current.setDate(current.getDate()+1);const key=iso(current);
    const place=(sourceId,amount,seen=new Set())=>{const record=byId.get(Number(sourceId));if(!record||amount<=0||seen.has(Number(sourceId)))return;seen.add(Number(sourceId));const investment=record.investment,active=current<=investmentMaturity(investment),cap=Math.max(0,Number(investment.interestCap||0)),space=active?(cap?Math.max(0,cap-record.principal):amount):0,accepted=Math.min(amount,space);record.balance+=accepted;record.principal+=accepted;const excess=amount-accepted,target=Number(investment.redirectInvestmentId||0);if(excess>0&&target)place(target,excess,seen);};
    for(const plan of planByDate[key]||[])place(plan.sourceId,plan.amount);
    for(const record of records){const investment=record.investment;if(current>investmentMaturity(investment))continue;const start=new Date(`${investment.startDate}T12:00:00`),elapsed=Math.floor((current-start)/86400000);if(elapsed<=0)continue;const initialDay=start.getDate(),dayInMonth=Math.min(initialDay,new Date(current.getFullYear(),current.getMonth()+1,0).getDate()),monthDistance=(current.getFullYear()-start.getFullYear())*12+current.getMonth()-start.getMonth(),frequency=investment.frequency||'monthly';const compound=frequency==='daily'||(frequency==='weekly'&&elapsed%7===0)||(frequency==='monthly'&&current.getDate()===dayInMonth)||(frequency==='quarterly'&&monthDistance>0&&monthDistance%3===0&&current.getDate()===dayInMonth)||(frequency==='yearly'&&monthDistance>0&&monthDistance%12===0&&current.getDate()===dayInMonth);if(compound){const cap=Math.max(0,Number(investment.interestCap||0)),simple=cap>0&&investment.interestMode==='simple'&&record.principal>=cap,interest=(simple?record.principal:record.balance)*(Math.max(-.99,Number(investment.rate||0)/100)/frequencyPeriods(frequency));record.balance+=interest-(investment.taxMode==='capital'?0:Math.max(0,interest)*(Math.max(0,Number(investment.taxRate||0))/100));}record.balance-=investment.annualFeeType==='amount'?Math.max(0,Number(investment.annualFeeAmount||0))/365:Math.max(0,record.balance)*(Math.max(0,Number(investment.annualFee||0))/100)/365;if(investment.taxMode==='capital')record.balance-=Math.max(0,record.balance)*(Math.max(0,Number(investment.taxRate||0))/100)/365;}
    while(pointIndex<dates.length&&iso(current)===iso(dates[pointIndex])){snapshots.push(snapshot(current));pointIndex++;}
  }
  while(snapshots.length<dates.length)snapshots.push(snapshot(dates[snapshots.length]));return snapshots;
}
function toast(message){ const el=$('#toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2800); }
function $(selector){ return document.querySelector(selector); }
function $all(selector){ return [...document.querySelectorAll(selector)]; }

function renderDashboard(){
  const income=amount('income'), expense=amount('expense'), investment=amount('investment'), balance=income-expense;
  $('#balance-value').textContent=money.format(balance); $('#income-value').textContent=money.format(income); $('#expense-value').textContent=money.format(expense);
  $('#expense-note').textContent=`${currentMovements().filter(m=>m.type==='expense').length} gastos este mes`;
  $('#saving-value').textContent=money.format(investment);
  $('#saving-note').textContent='Registradas este mes';
  $('.month-label').textContent=new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric'}).format(today).toUpperCase();
  $('.welcome h2').innerHTML='Tu dinero, claro <span>✦</span>';
  renderCategories(); renderBudgets(); renderRecent(); renderMoneyChart(); renderRecurring();
}
function renderCategories(){
  const grouped={}; currentMovements().filter(m=>m.type==='expense').forEach(m=>grouped[m.category]=(grouped[m.category]||0)+Number(m.amount));
  const rows=Object.entries(grouped).sort((a,b)=>b[1]-a[1]); const total=rows.reduce((s,[,a])=>s+a,0);
  let accumulated=0;
  const slices=rows.map(([,value],i)=>{const start=accumulated;accumulated+=value/total*100;return `${COLORS[i%COLORS.length]} ${start}% ${accumulated}%`;});
  $('#category-chart').style.background=rows.length?`conic-gradient(${slices.join(',')})`:'#e9eeea';
  $('#category-total').textContent=money.format(total);
  $('#category-chart').setAttribute('aria-label',rows.length?`Gastos del mes por categoría. Total ${money.format(total)}.`:'Aún no hay gastos este mes.');
  $('#category-legend').innerHTML=rows.length ? rows.map(([cat,value],i)=>`<span class="legend-item"><i class="legend-dot" style="background:${COLORS[i%COLORS.length]}"></i>${escapeHtml(cat)} ${Math.round(value/total*100)}%</span>`).join('') : '<span class="legend-item">Aún no hay gastos este mes.</span>';
}
function budgetSpent(budget){const records=state.movements.filter(m=>m.type==='expense'&&m.category===budget.category);if(budget.period==='weekly'){const weekStart=new Date(today);weekStart.setDate(today.getDate()-((today.getDay()+6)%7));return records.filter(m=>m.date>=iso(weekStart)&&m.date<=iso(today)).reduce((sum,m)=>sum+Number(m.amount),0);}if(budget.period==='yearly')return records.filter(m=>m.date.startsWith(String(today.getFullYear()))).reduce((sum,m)=>sum+Number(m.amount),0);return records.filter(m=>m.date.startsWith(monthKey())).reduce((sum,m)=>sum+Number(m.amount),0);}
function budgetMarkup(budget){const spent=budgetSpent(budget),limit=Number(budget.limit)||0,pct=limit?Math.min(100,spent/limit*100):0,warning=limit>0&&spent/limit>=.8;return `<div class="budget-row"><div class="budget-head"><strong>${escapeHtml(budget.category)} · ${frequencyLabel(budget.period||'monthly')}</strong><span>${money.format(spent)} / ${money.format(limit)}</span></div><div class="progress ${warning?'warn':''}"><span style="width:${pct}%"></span></div><p>${spent>limit?'Excediste el límite.':money.format(Math.max(0,limit-spent))+' disponibles en este periodo.'}</p>${spent>limit?repayMarkup(budget,spent-limit):''}${budgetOverlapNote(budget)}</div>`;}
function renderBudgets(){ $('#budget-list').innerHTML=state.budgets.length?state.budgets.map(b=>`<article class="budget-item"><h3>${escapeHtml(b.category)}</h3>${budgetMarkup(b)}<div class="goal-actions"><button class="small-button edit-budget" data-id="${b.id}">Editar</button><button class="small-button danger-button delete-budget" data-id="${b.id}">Eliminar</button></div></article>`).join(''):'<p class="empty">Aún no hay límites por categoría.</p>'; $all('.edit-budget').forEach(button=>button.onclick=()=>editBudget(Number(button.dataset.id)));$all('.open-repay').forEach(button=>button.onclick=()=>openRepay(Number(button.dataset.id)));$all('.remove-repay').forEach(button=>button.onclick=()=>{if(confirm('¿Quitar este plan para reponer?')){state.recurringPlans=state.recurringPlans.filter(plan=>plan.id!==Number(button.dataset.id));save();renderAll();toast('Plan para reponer quitado.');}});$all('.delete-budget').forEach(b=>b.onclick=()=>{const budget=state.budgets.find(item=>item.id===Number(b.dataset.id));if(budget&&confirm(`¿Eliminar el límite de ${budget.category}?`)){state.budgets=state.budgets.filter(x=>x.id!==budget.id);save();renderAll();toast('Límite eliminado.');}}); }
function renderRecent(){ $('#recent-movements').innerHTML=[...state.movements].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4).map(movement=>movementMarkup(movement)).join('') || '<p class="empty">Aún no hay movimientos.</p>'; }
function movementMarkup(m, allowEdit=false){ const sign=m.type==='income'?'+':m.type==='transfer'?'↔ ':'−'; const typeClass=m.type==='transfer'?'investment':m.type; return `<div class="movement-row"><span class="category-icon">${ICONS[m.category]||'•'}</span><div class="movement-info"><strong>${escapeHtml(m.title)}</strong><small>${escapeHtml(m.category)} · ${displayDate(m.date)}${m.type==='transfer'?` · ${escapeHtml(accountLabel(m.accountId)||'Sin cuenta de origen')} → ${escapeHtml(accountLabel(m.toAccountId)||'cuenta eliminada')}`:accountLabel(m.accountId)?` · ${escapeHtml(accountLabel(m.accountId))}`:''}</small>${m.note?`<span class="movement-note">Nota: ${escapeHtml(m.note)}</span>`:''}</div><span class="movement-amount ${typeClass}">${sign}${money.format(m.amount)}</span>${allowEdit?`<span class="movement-actions">${!m.investmentId&&m.type!=='transfer'?`<button type="button" class="small-button edit-movement" data-id="${m.id}">Editar</button>`:''}<button type="button" class="small-button danger-button delete-movement" data-id="${m.id}">Eliminar</button></span>`:''}</div>`; }
function renderMovements(){ const type=$('#movement-type-filter').value, category=$('#movement-category-filter').value; const all=state.movements.filter(m=>(type==='all'||m.type===type)&&(category==='all'||m.category===category)).sort((a,b)=>b.date.localeCompare(a.date)); $('#movement-list').innerHTML=all.length?all.map(m=>movementMarkup(m,true)).join(''):'<p class="empty">No hay movimientos con esos filtros.</p>'; $all('.edit-movement').forEach(button=>button.onclick=()=>editMovement(Number(button.dataset.id))); $all('.delete-movement').forEach(button=>button.onclick=()=>deleteMovement(Number(button.dataset.id))); }
function goalLinkedValue(goal){if(!goal.linkType||goal.linkType==='none')return 0;if(goal.linkType==='account'){const account=state.accounts.find(item=>item.id===Number(goal.accountId));return account?Math.max(0,accountBalanceToday(account)):0;}const linked=state.investments.filter(investment=>goal.linkType==='portfolio'||Number(goal.investmentId)===Number(investment.id));return linked.reduce((sum,investment)=>{const metrics=investmentMetrics(investment);if(goal.linkType==='interest')return sum+Math.max(0,metrics.gain);return sum+metrics.value;},0);}
function renderGoals(){ $('#goal-list').innerHTML=state.goals.length?state.goals.map(g=>{const linked=goalLinkedValue(g),current=Number(g.current)+linked,pct=Math.min(100,current/g.target*100),linkLabel=g.linkType==='account'?(accountLabel(g.accountId)?`el saldo de ${escapeHtml(accountLabel(g.accountId))}`:'una cuenta que ya no existe'):g.linkType==='interest'?'intereses estimados':g.linkType==='portfolio'?'portafolio estimado':g.linkType==='investment'?'inversión vinculada':''; return `<article class="goal-item"><div class="goal-top"><div><h3>${escapeHtml(g.name)}</h3><p>${money.format(current)} de ${money.format(g.target)}</p></div><span class="goal-icon">◎</span></div>${linkLabel?`<p class="goal-link-note">Incluye ${linkLabel}: ${money.format(linked)}</p>`:''}${(g.linkType==='account'||g.linkType==='investment')&&accountLabel(g.originAccountId)?`<p class="goal-link-note">El ahorro sale de ${escapeHtml(accountLabel(g.originAccountId))}</p>`:''}<div class="progress"><span style="width:${pct}%"></span></div><div class="budget-head" style="margin-top:10px"><span>${Math.round(pct)}% completado</span><strong>Faltan ${money.format(Math.max(0,g.target-current))}</strong></div><div class="goal-actions"><button class="small-button edit-goal" data-id="${g.id}">Editar</button><button class="small-button add-to-goal" data-id="${g.id}">Añadir ahorro</button><button class="small-button danger-button delete-goal" data-id="${g.id}">Eliminar</button></div></article>`;}).join(''):'<p class="empty">Aún no hay metas.</p>'; $all('.edit-goal').forEach(button=>button.onclick=()=>editGoal(Number(button.dataset.id)));$all('.add-to-goal').forEach(b=>b.onclick=()=>addToGoal(Number(b.dataset.id))); $all('.delete-goal').forEach(b=>b.onclick=()=>{const goal=state.goals.find(item=>item.id===Number(b.dataset.id));if(goal&&confirm(`¿Eliminar la meta “${goal.name}”?`)){state.goals=state.goals.filter(g=>g.id!==goal.id);save();renderAll();toast('Meta eliminada.');}}); }
function renderReminders(){ const ordered=[...state.reminders].sort((a,b)=>reminderNextDate(a).localeCompare(reminderNextDate(b))); $('#reminder-list').innerHTML=cardReminderMarkup()+(ordered.length?ordered.map(r=>`<article class="reminder-item"><span class="category-icon">${r.kind==='payment'?'$':r.kind==='habit'?'↻':'◔'}</span><h3 style="margin-top:13px">${escapeHtml(r.title)}</h3><p class="reminder-date">${reminderRepeats(r)?`Próximo: ${displayDate(reminderNextDate(r))}`:displayDate(r.date)} · ${r.kind==='payment'?'Pago':r.kind==='habit'?'Hábito':'Revisión'}${reminderRepeats(r)?` · ${REMINDER_REPEAT_LABEL[r.repeat]}`:''}</p><div class="goal-actions"><button class="small-button edit-reminder" data-id="${r.id}">Editar</button><button class="small-button danger-button delete-reminder" data-id="${r.id}">Eliminar</button></div></article>`).join(''):cardEvents().length?'':'<p class="empty">No tienes recordatorios.</p>');$all('.config-card').forEach(button=>button.onclick=()=>editAccount(Number(button.dataset.id))); $all('.edit-reminder').forEach(button=>button.onclick=()=>{const reminder=state.reminders.find(item=>item.id===Number(button.dataset.id));if(!reminder)return;editingReminderId=reminder.id;const form=$('#reminder-form');form.reset();form.elements.title.value=reminder.title;form.elements.date.value=reminder.date;form.elements.kind.value=reminder.kind||'payment';form.elements.repeat.value=reminder.repeat||'none';$('#reminder-dialog h2').textContent='Editar recordatorio';$('#reminder-form .submit-button').textContent='Guardar cambios';open('#reminder-dialog');});$all('.delete-reminder').forEach(b=>b.onclick=()=>{const reminder=state.reminders.find(item=>item.id===Number(b.dataset.id));if(reminder&&!confirm(`¿Eliminar el recordatorio “${reminder.title}”?`))return;state.reminders=state.reminders.filter(r=>r.id!==Number(b.dataset.id));save();renderAll();toast('Recordatorio eliminado.');}); }
function nextOccurrence(date,frequency){const next=new Date(date);if(frequency==='weekly')next.setDate(next.getDate()+7);else if(frequency==='biweekly')next.setDate(next.getDate()+14);else if(frequency==='monthly'){const day=next.getDate();next.setDate(1);next.setMonth(next.getMonth()+1);next.setDate(Math.min(day,new Date(next.getFullYear(),next.getMonth()+1,0).getDate()));}else{const day=next.getDate(),month=next.getMonth();next.setDate(1);next.setFullYear(next.getFullYear()+1);next.setMonth(month);next.setDate(Math.min(day,new Date(next.getFullYear(),month+1,0).getDate()));}return next;}
function countPlanTo(plan,target){const limit=new Date(`${iso(target)}T12:00:00`),start=new Date(`${iso(today)}T12:00:00`),max=Number(plan.occurrences)>0?Number(plan.occurrences):Infinity;let date=new Date(`${plan.startDate}T12:00:00`),count=0,index=0,guard=0;while(date<=limit&&index<max&&guard++<5000){if(date>=start)count++;date=nextOccurrence(date,plan.frequency);index++;}return count;}
function renderRecurring(){
 const labels={weekly:'Semanal',biweekly:'Quincenal',monthly:'Mensual',yearly:'Anual'},types={income:'Ingreso',expense:'Gasto',investment:'Ahorro'};
 $('#recurring-list').innerHTML=state.recurringPlans.length?state.recurringPlans.map(plan=>`<article class="budget-item"><h3>${escapeHtml(plan.title)}</h3><p>${plan.repayment?'Reposición':types[plan.type]} · ${labels[plan.frequency]}${accountLabel(plan.accountId)?` · ${plan.type==='income'?'llega a':'sale de'} ${escapeHtml(accountLabel(plan.accountId))}`:''}${plan.type==='investment'&&(accountLabel(plan.toAccountId)||plan.investmentId)?` · va a ${escapeHtml(accountLabel(plan.toAccountId)||investmentName(state.investments.find(item=>item.id===Number(plan.investmentId))||{institution:'',product:'inversión'}))}`:''}${Number(plan.occurrences)>0?` · ${plan.occurrences} pago(s), termina el ${displayDate(iso(planOccurrenceDates(plan).at(-1)))}`:''}</p><strong>${money.format(plan.amount)} cada vez</strong>${planOverlapNote(plan)}${fundedByPlan(plan.id).map(investment=>`<p class="plan-funding">Aparta ${money.format(investment.fundingAmount)} para ${escapeHtml(investmentName(investment))} cada vez</p>`).join('')}<div class="goal-actions"><button class="small-button edit-recurring" data-id="${plan.id}">Editar</button><button class="small-button danger-button delete-recurring" data-id="${plan.id}">Eliminar</button></div></article>`).join(''):'<p class="empty">Sin planes registrados.</p>';
 $all('.edit-recurring').forEach(button=>button.onclick=()=>editRecurringPlan(Number(button.dataset.id)));
 $all('.delete-recurring').forEach(button=>button.onclick=()=>{const planId=Number(button.dataset.id),funded=fundedByPlan(planId);if(funded.length&&!confirm(`Este ingreso paga aportaciones a ${funded.map(investmentName).join(', ')}. Si lo eliminas, esas aportaciones planeadas también se quitan. ¿Continuar?`))return;funded.forEach(investment=>{investment.fundingPlanId=null;investment.fundingAmount=0;});state.recurringPlans=state.recurringPlans.filter(plan=>plan.id!==planId);save();renderAll();toast('Plan eliminado.');});
 renderBudgetProjection();
}
function populateRecurringInvestmentChoices(){const select=$('#recurring-investment');const accounts=state.accounts.map(account=>`<option value="account-${account.id}">${escapeHtml(accountLabel(account.id))}</option>`).join(''),investments=state.investments.map(investment=>`<option value="${investment.id}">${escapeHtml(investmentName(investment))}</option>`).join('');select.innerHTML='<option value="">Sin elegir</option>'+(accounts?`<optgroup label="Tus cuentas de banco">${accounts}</optgroup>`:'')+(investments?`<optgroup label="Tus inversiones">${investments}</optgroup>`:'');}
function addRecurringInvestmentSelect(){const form=$('#recurring-form'),type=form.elements.type,label=document.createElement('label');label.id='recurring-investment-label';label.innerHTML='¿A dónde va el dinero?<select name="investmentId" id="recurring-investment"></select>';type.closest('label').insertAdjacentElement('afterend',label);label.hidden=true;type.onchange=()=>{label.hidden=type.value!=='investment';};}
function renderAccounts(){
  const debit=state.accounts.filter(account=>account.kind!=='credit'),credit=state.accounts.filter(account=>account.kind==='credit');
  const have=debit.reduce((sum,account)=>sum+accountBalanceToday(account),0),cards=credit.reduce((sum,account)=>sum+accountBalanceToday(account),0);
  const limits=credit.filter(account=>Number(account.creditLimit)>0),available=limits.reduce((sum,account)=>sum+Math.max(0,Number(account.creditLimit)+accountBalanceToday(account)),0);
  const stat=(label,value,extra='')=>`<article class="capital-stat"><small>${label}</small><strong class="${value<0?'negative':''}">${money.format(value)}</strong>${extra}</article>`;
  $('#accounts-summary').innerHTML=stat('Débito y ahorro',have)+stat('Tarjetas de crédito',cards)+(limits.length?stat('Crédito disponible',available,`<small>de ${money.format(limits.reduce((sum,account)=>sum+Number(account.creditLimit),0))} de límite</small>`):'')+stat('Saldo total',have+cards);
  $('#account-list').innerHTML=state.accounts.length?state.accounts.map(account=>`<div class="account-row"><div><strong>${escapeHtml(account.name)}</strong><small>${escapeHtml(account.institution||'')}${account.yield?` · paga ${Number(account.yield.rate).toFixed(2)}% anual${Number(account.yield.cap)>0?` hasta ${money.format(account.yield.cap)}`:''}`:''}${account.kind==='credit'?` · tarjeta de crédito${account.cutDay?` · corte el día ${account.cutDay}`:''}${account.dueDay?` · pago límite el día ${account.dueDay}`:''}${Number(account.creditLimit)>0?` · disponible ${money.format(Math.max(0,Number(account.creditLimit)+accountBalanceToday(account)))} de ${money.format(account.creditLimit)}`:''}`:account.balanceDate?` · registraste ${money.format(account.initialBalance)} el ${displayDate(account.balanceDate)}`:''}${accountEndOfMonthNote(account)}</small></div><strong title="Saldo de hoy" class="${accountBalanceToday(account)<0?'negative':''}">${money.format(accountBalanceToday(account))}</strong><span><button class="small-button edit-account" data-id="${account.id}">Editar</button> <button class="small-button danger-button delete-account" data-id="${account.id}">Eliminar</button></span></div>`).join(''):'<p class="empty">Sin cuentas registradas.</p>';
  $all('.edit-account').forEach(button=>button.onclick=()=>editAccount(Number(button.dataset.id)));
  $all('.delete-account').forEach(button=>button.onclick=()=>{const account=state.accounts.find(item=>item.id===Number(button.dataset.id));if(account&&confirm(`¿Eliminar la cuenta “${account.name}”? Sus movimientos se conservan, pero quedarán sin cuenta.`)){state.accounts=state.accounts.filter(item=>item.id!==account.id);state.movements.forEach(movement=>{if(Number(movement.accountId)===account.id)movement.accountId=null;});[...state.recurringPlans,...state.investments].forEach(item=>{if(Number(item.accountId)===account.id)item.accountId=null;if(Number(item.toAccountId)===account.id)item.toAccountId=null;});save();renderAll();toast('Cuenta eliminada.');}});
  renderAccountsChart();
}
function renderAccountsChart(){
  const box=$('#accounts-chart');if(!state.accounts.length){box.innerHTML='<p class="empty">Agrega una cuenta de débito o una tarjeta de crédito para ver aquí cómo cambia su saldo.</p>';return;}
  const months=Number(state.preferences.accountsHorizon||3),end=addMonthsClamped(today,months),days=Math.max(1,Math.round((end-today)/86400000)),count=months===1?Math.min(days,30):months<=3?Math.ceil(days/7):months;
  const dates=Array.from({length:count+1},(_,index)=>{if(months>3)return addMonthsClamped(today,index);const date=new Date(today);date.setDate(date.getDate()+(months===1?index:index*7));return date>end?new Date(end):date;});
  const entries=state.accounts.map((account,index)=>({account,label:accountLabel(account.id),color:LINE_COLORS[index%LINE_COLORS.length],values:dates.map((date,i)=>i===0?accountBalanceToday(account):accountProjectedOn(account,iso(date)))}));
  const W=960,H=360,left=110,right=24,top=20,bottom=50,plotW=W-left-right,plotH=H-top-bottom;
  const all=entries.flatMap(entry=>entry.values),{low,high,step}=niceScale(Math.min(0,...all),Math.max(0,...all));
  const x=index=>left+(index/Math.max(1,dates.length-1))*plotW,y=value=>top+(high-value)/(high-low)*plotH;
  const grid=[];for(let value=high,guard=0;value>=low-step/2&&guard<12;value-=step,guard++)grid.push(`<line x1="${left}" y1="${y(value)}" x2="${W-right}" y2="${y(value)}" stroke="#e8ede9"/><text x="${left-9}" y="${y(value)+4}" text-anchor="end" fill="#80928c" font-size="17">${axisMoney.format(Math.abs(value)<1e-9?0:value)}</text>`);
  const zero=low<0?`<line x1="${left}" y1="${y(0)}" x2="${W-right}" y2="${y(0)}" stroke="#aab9b2" stroke-width="1.4"/>`:'';
  const fmt=new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short'}),step2=Math.ceil(dates.length/8);
  const labels=dates.map((date,index)=>index%step2===0||index===dates.length-1?`<text x="${x(index)}" y="${H-16}" text-anchor="middle" fill="#80928c" font-size="17">${index===0?'Hoy':fmt.format(date)}</text>`:'').join('');
  const lines=entries.map(entry=>`<path d="${entry.values.map((value,index)=>`${index?'L':'M'} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ')}" fill="none" stroke="${entry.color}" stroke-width="3" ${entry.account.kind==='credit'?'stroke-dasharray="7 4"':''} stroke-linejoin="round"/>`).join('');
  const legend=`<div class="projection-lines-legend">${entries.map(entry=>`<span><i style="background:${entry.color}"></i>${escapeHtml(entry.label)}</span>`).join('')}</div>`;
  const last=dates.length-1,endName=new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric'}).format(dates[last]);
  const cell=value=>`<span class="${value<0?'negative':''}">${money.format(value)}</span>`;
  const rows=entries.map(entry=>{const limit=Number(entry.account.creditLimit)||0,availableNow=limit?Math.max(0,limit+entry.values[0]):null,availableEnd=limit?Math.max(0,limit+entry.values[last]):null;return `<tr><th><i class="legend-dot" style="background:${entry.color}"></i> ${escapeHtml(entry.label)}${entry.account.kind==='credit'?`<small class="muted-label">Tarjeta de crédito${limit?` · límite ${money.format(limit)}`:''}</small>`:''}</th><td>${cell(entry.values[0])}${availableNow!==null?`<small class="muted-label">disponible ${money.format(availableNow)}</small>`:''}</td><td>${cell(entry.values[last])}${availableEnd!==null?`<small class="muted-label">disponible ${money.format(availableEnd)}</small>`:''}</td></tr>`;}).join('');
  const totalNow=entries.reduce((sum,entry)=>sum+entry.values[0],0),totalEnd=entries.reduce((sum,entry)=>sum+entry.values[last],0);
  const bars=entries.filter(entry=>entry.account.kind==='credit'&&Number(entry.account.creditLimit)>0).map(entry=>{const limit=Number(entry.account.creditLimit),used=Math.max(0,-entry.values[0]),pct=Math.min(100,used/limit*100);return `<div class="credit-usage"><div class="credit-usage-head"><strong>${escapeHtml(entry.label)}</strong><span>Usado ${money.format(-used)} · disponible ${money.format(Math.max(0,limit-used))} de ${money.format(limit)}</span></div><div class="credit-usage-bar" role="img" aria-label="Usas el ${pct.toFixed(0)}% de tu límite"><i style="width:${pct}%;background:${pct>=80?'#c94d45':pct>=50?'#d39b2c':'var(--green)'}"></i></div></div>`;}).join('');
  box.innerHTML=`<div class="investment-forecast"><p>MXN estimados con tus movimientos y planes recurrentes. Línea continua: débito · línea punteada: tarjetas de crédito (lo que debes aparece en negativo).</p>${legend}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo estimado de tus cuentas">${grid.join('')}${zero}${lines}${labels}</svg></div>${bars}<div class="projection-table-wrap account-balances"><table class="projection-table"><thead><tr><th>Cuenta</th><th>Hoy</th><th>${endName}</th></tr></thead><tbody>${rows}<tr class="total-row"><th>Total</th><td><strong>${cell(totalNow)}</strong></td><td><strong>${cell(totalEnd)}</strong></td></tr></tbody></table></div>`;
}
function renderCapital(){
  const initialTotal=state.accounts.reduce((sum,account)=>sum+Number(account.initialBalance),0)+state.investments.reduce((sum,investment)=>sum+Number(investment.capital),0);
  const metrics=state.investments.map(investment=>({investment,...investmentMetrics(investment)}));
  const invested=metrics.reduce((sum,item)=>sum+item.principal,0),portfolio=metrics.reduce((sum,item)=>sum+item.value,0),gain=portfolio-invested;
  const gainPct=invested?gain/invested*100:0;
  $('#capital-summary').innerHTML=`<article class="capital-stat"><small>Inversiones registradas</small><strong>${metrics.length}</strong></article><article class="capital-stat"><small>Valor invertido estimado</small><strong>${money.format(portfolio)}</strong></article><article class="capital-stat"><small>Ganancia acumulada</small><strong class="${gain>=0?'positive':'negative'}">${money.format(gain)}</strong><small class="${gain>=0?'positive':'negative'}">${gainPct.toFixed(2)}% desde el inicio</small></article><article class="capital-stat"><small>Capital aportado</small><strong>${money.format(invested)}</strong></article>`;
  renderInvestmentPortfolio(metrics,invested,portfolio);
  const projectionHelp=$('.portfolio-grid .projection-card .card-title p');if(projectionHelp)projectionHelp.textContent='Estimación a 3, 6 y 12 meses y al plazo configurado de cada inversión.';
}
/* Portafolio: inversiones y cuentas de banco (también tienen flujo de dinero y pueden pagar intereses). */
function portfolioEntries(){
  return [
    ...state.investments.map((investment,index)=>({key:`i${investment.id}`,label:investmentName(investment),color:COLORS[index%COLORS.length]}))
  ];
}
function renderPortfolioDistribution(point,entries=portfolioEntries()){
  const rows=entries.map((entry,index)=>({...entry,value:Number(point?.values?.[index]||0)})).filter(entry=>entry.value>0);
  const total=rows.reduce((sum,entry)=>sum+entry.value,0);let running=0;
  const slices=rows.map(entry=>{const start=running;running+=entry.value/total*100;return `${entry.color} ${start}% ${running}%`;});
  $('#portfolio-chart').style.background=rows.length?`conic-gradient(${slices.join(',')})`:'#e9eeea';
  $('#portfolio-chart-total').textContent=money.format(total);
  $('#portfolio-chart').setAttribute('aria-label',rows.length?`Distribución de ${money.format(total)}.`:'No hay saldo en este punto.');
  const debts=entries.map((entry,index)=>({...entry,value:Number(point?.values?.[index]||0)})).filter(entry=>entry.value<0);
  $('#portfolio-legend').innerHTML=(rows.length?rows.map(entry=>`<span class="legend-item"><i class="legend-dot" style="background:${entry.color}"></i>${escapeHtml(entry.label)} ${(entry.value/total*100).toFixed(1)}%</span>`).join(''):'<span class="legend-item">Sin saldo en este punto.</span>')+debts.map(entry=>`<span class="legend-item">${escapeHtml(entry.label)}: debes ${money.format(-entry.value)}</span>`).join('');
}
function renderPortfolioChart(metrics,invested,portfolio){
  const entries=portfolioEntries();
  if(!entries.length){$('#projection-list').innerHTML='<p class="empty">Agrega una inversión para ver aquí su proyección en el tiempo. Tus cuentas de débito y crédito no se cuentan aquí.</p>';renderPortfolioDistribution({values:[],total:0},entries);return;}
  const horizonChoice=state.preferences.projectionHorizon||'12',maturities=state.investments.map(investment=>investmentMaturity(investment).getTime());
  const horizon=horizonChoice==='maturity'?new Date(Math.max(addMonthsClamped(today,1).getTime(),...maturities)):addMonthsClamped(today,Number(horizonChoice)||12),days=Math.max(1,Math.ceil((horizon-today)/86400000));
  const unit=days<=60?'day':days<=730?'month':'year',unitCount=unit==='day'?days:unit==='month'?Math.max(1,Math.round(days/30.4375)):Math.max(1,Math.round(days/365.25));
  const ticks=Math.min(12,unitCount),labels=Array.from({length:ticks+1},(_,i)=>Math.round(unitCount*i/ticks));
  const dates=labels.map(value=>{if(unit==='day'){const date=new Date(today);date.setDate(date.getDate()+value);return date;}return addMonthsClamped(today,unit==='month'?value:value*12);});
  const snapshots=projectionSnapshots(dates);
  const points=snapshots.map((snapshot,index)=>{const values=[...snapshot.values];return{values,total:values.reduce((sum,value)=>sum+value,0),label:index===0?'Hoy':unit==='day'?`${labels[index]} d`:unit==='month'?`${labels[index]} m`:`${labels[index]} a`};});
  selectedPortfolioPointIndex=Math.min(Math.max(0,selectedPortfolioPointIndex),points.length-1);
  const W=960,H=340,left=96,right=24,top=24,bottom=58,plotW=W-left-right,plotH=H-top-bottom;
  const all=points.flatMap(point=>[point.total,...point.values]),scale=niceScale(Math.min(0,...all),Math.max(0,...all)),{low,high,step}=scale;
  const x=index=>left+(index/Math.max(1,points.length-1))*plotW,y=value=>top+(high-value)/(high-low)*plotH;
  const gridValues=[];for(let value=high,guard=0;value>=low-step/2&&guard<12;value-=step,guard++)gridValues.push(value);
  const grid=gridValues.map(value=>`<g><line x1="${left}" y1="${y(value)}" x2="${W-right}" y2="${y(value)}" stroke="#e8ede9"/><text x="${left-9}" y="${y(value)+4}" text-anchor="end" fill="#80928c" font-size="11">${axisMoney.format(Math.abs(value)<1e-9?0:value)}</text></g>`).join('');
  const zero=low<0?`<line x1="${left}" y1="${y(0)}" x2="${W-right}" y2="${y(0)}" stroke="#aab9b2" stroke-width="1.2"/>`:'';
  const productLines=entries.map((entry,entryIndex)=>`<path d="${points.map((point,index)=>`${index?'L':'M'} ${x(index)} ${y(point.values[entryIndex])}`).join(' ')}" fill="none" stroke="${entry.color}" stroke-width="2.2" ${entry.account?'stroke-dasharray="7 4"':''} opacity=".95"/>`).join('');
  const totalPath=points.map((point,index)=>`${index?'L':'M'} ${x(index)} ${y(point.total)}`).join(' ');
  const dots=points.map((point,index)=>`<circle class="projection-point ${index===selectedPortfolioPointIndex?'selected':''}" data-point="${index}" cx="${x(index)}" cy="${y(point.total)}" r="${index===selectedPortfolioPointIndex?7:5}" fill="#146c5b"><title>${point.label}: ${money.format(point.total)}</title></circle><text x="${x(index)}" y="${H-16}" text-anchor="middle" fill="#80928c" font-size="11">${point.label}</text>`).join('');
  const unitName=({day:'días',month:'meses',year:'años'})[unit];
  const legend=`<div class="projection-lines-legend"><span><i style="background:#146c5b"></i>Total</span>${entries.map(entry=>`<span><i style="background:${entry.color}"></i>${escapeHtml(entry.label)}</span>`).join('')}</div>`;
  const chart=`<div class="investment-forecast"><p>${unitName} desde hoy · MXN estimados. Solo inversiones (tus cuentas de débito y crédito no se incluyen). Toca un punto para ver la distribución.</p>${legend}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Proyección estimada de tus inversiones">${grid}${zero}${productLines}<path d="${totalPath}" fill="none" stroke="#146c5b" stroke-width="4"/>${dots}</svg></div>`;
  const selected=points[selectedPortfolioPointIndex];
  const lastIndex=points.length-1,cols=[0,...(selectedPortfolioPointIndex>0&&selectedPortfolioPointIndex<lastIndex?[selectedPortfolioPointIndex]:[]),lastIndex];
  const colName=index=>index===0?'Hoy':`${new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric'}).format(dates[index])}`;
  const cell=value=>money.format(value);
  const balances=`<div class="projection-table-wrap account-balances"><table class="projection-table"><thead><tr><th>Valor por inversión</th>${cols.map(index=>`<th>${colName(index)}</th>`).join('')}</tr></thead><tbody>${entries.map((entry,entryIndex)=>`<tr><th><i class="legend-dot" style="background:${entry.color}"></i> ${escapeHtml(entry.label)}</th>${cols.map(index=>`<td>${cell(points[index].values[entryIndex])}</td>`).join('')}</tr>`).join('')}<tr class="total-row"><th>Total</th>${cols.map(index=>`<td><strong>${money.format(points[index].total)}</strong></td>`).join('')}</tr></tbody></table></div>`;
  $('#projection-list').innerHTML=chart+balances+`<p class="projection-selected">Distribución seleccionada: <strong>${selected.label}</strong> · ${money.format(selected.total)}</p>`;
  renderPortfolioDistribution(selected,entries);
  $all('.projection-point').forEach(dot=>dot.onclick=()=>{selectedPortfolioPointIndex=Number(dot.dataset.point);renderInvestmentPortfolio(metrics,invested,portfolio);});
}
function renderInvestmentPortfolio(metrics,invested,portfolio){
  renderPortfolioChart(metrics,invested,portfolio);
  $('#investment-list').innerHTML=metrics.length?metrics.map((item,index)=>{const investment=item.investment,share=portfolio?item.value/portfolio*100:0;const operations=[...(investment.operations||[])].sort((a,b)=>b.date.localeCompare(a.date));const maturity=investmentMaturity(investment);const maturityValue=investmentValue(investment,maturity,true),gainPct=item.principal?item.gain/item.principal*100:0,redirect=state.investments.find(candidate=>Number(candidate.id)===Number(investment.redirectInvestmentId));return `<article class="investment-card"><div class="investment-card-head"><div><p class="eyebrow">${escapeHtml(investment.institution)}</p><h3>${escapeHtml(investment.product)}</h3></div><span class="investment-share" style="--share-color:${COLORS[index%COLORS.length]}">${share.toFixed(1)}%</span></div><strong class="investment-value">${money.format(item.value)}</strong><small class="muted-label">Estimado actual</small><div class="investment-facts"><span>Aportado<strong>${money.format(item.principal)}</strong></span><span>Ganancia desde el inicio<strong>${money.format(item.gain)} · ${gainPct.toFixed(2)}%</strong></span><span>Tasa anual configurada<strong>${Number(investment.rate).toFixed(2)}%</strong></span><span>Capitalización<strong>${frequencyLabel(investment.frequency)}</strong></span><span>ISR estimado<strong>${Number(investment.taxRate||0).toFixed(2)}% ${investment.taxMode==='capital'?'al año sobre saldo':'de la ganancia'}</strong></span><span>Comisión anual<strong>${investment.annualFeeType==='amount'?money.format(investment.annualFeeAmount||0):`${Number(investment.annualFee||0).toFixed(2)}%`}</strong></span><span>Inicio<strong>${displayDate(investment.startDate)}</strong></span><span>Plazo<strong>${durationLabel(investment)}</strong></span>${accountLabel(investment.accountId)?`<span>Cuenta conectada<strong>${escapeHtml(accountLabel(investment.accountId))}</strong></span>`:''}<span>Al finalizar<strong>${money.format(maturityValue)}</strong></span>${Number(investment.interestCap)>0?`<span>Tope de aportación<strong>${money.format(investment.interestCap)} · ${investment.interestMode==='simple'?'simple':'compuesto'}</strong></span>`:''}${redirect?`<span>Excedente planeado<strong>→ ${escapeHtml(investmentName(redirect))}</strong></span>`:''}</div>${Number(investment.monthlyContribution)>0?`<p class="investment-contribution">Aportación prevista: ${money.format(investment.monthlyContribution)} al mes</p>`:''}${fundingSource(investment)?`<p class="investment-contribution">Se paga con “${escapeHtml(fundingSource(investment).title)}”: ${money.format(investment.fundingAmount)} cada vez que llega (${frequencyLabel(fundingSource(investment).frequency).toLowerCase()})</p>`:''}<div class="investment-actions"><button class="small-button investment-add-operation" data-id="${investment.id}">Aportar o retirar</button><button class="small-button edit-investment" data-id="${investment.id}">Editar</button><button class="small-button danger-button delete-investment" data-id="${investment.id}">Eliminar</button></div><details class="investment-history"><summary>Operaciones (${operations.length})</summary>${operations.length?operations.map(operation=>`<div class="operation-row"><span>${operation.type==='contribution'?'Aportación':'Retiro'} · ${displayDate(operation.date)}${operation.reflectInBalance?' · reflejado en balance':''}</span><strong>${money.format(operation.amount)}</strong><button class="small-button edit-operation" data-investment-id="${investment.id}" data-id="${operation.id}">Editar</button><button class="small-button danger-button delete-operation" data-investment-id="${investment.id}" data-id="${operation.id}">Quitar</button></div>`).join(''):'<p class="empty">Sin operaciones.</p>'}</details></article>`;}).join(''):'<p class="empty">Sin inversiones registradas.</p>';
   $all('.investment-add-operation').forEach(button=>button.onclick=()=>openOperationFor(Number(button.dataset.id)));
  $all('.edit-investment').forEach(button=>button.onclick=()=>editInvestment(Number(button.dataset.id)));
  $all('.edit-operation').forEach(button=>button.onclick=()=>editInvestmentOperation(Number(button.dataset.investmentId),Number(button.dataset.id)));
  $all('.delete-operation').forEach(button=>button.onclick=()=>{const investment=state.investments.find(item=>item.id===Number(button.dataset.investmentId));if(investment&&confirm('¿Quitar esta operación de la inversión?')){investment.operations=investment.operations.filter(operation=>operation.id!==Number(button.dataset.id));state.movements=state.movements.filter(movement=>movement.investmentOperationId!==Number(button.dataset.id));save();renderAll();toast('Operación eliminada.');}});
  $all('.delete-investment').forEach(button=>button.onclick=()=>{const investment=state.investments.find(item=>item.id===Number(button.dataset.id));if(investment&&confirm(`¿Eliminar “${investment.institution} · ${investment.product}” y sus operaciones reflejadas?`)){state.investments=state.investments.filter(item=>item.id!==investment.id);state.movements=state.movements.filter(movement=>movement.investmentId!==investment.id);save();renderAll();toast('Inversión eliminada.');}});
}
function frequencyLabel(value){return{daily:'Diaria',weekly:'Semanal',biweekly:'Quincenal',monthly:'Mensual',quarterly:'Trimestral',yearly:'Anual'}[value]||'Mensual';}
function populateCategories(){ const select=$('#movement-category'); const type=$('#movement-type').value; select.innerHTML=CATEGORIES[type].map(c=>`<option>${c}</option>`).join(''); $all('.expense-categories').forEach(s=>s.innerHTML=CATEGORIES.expense.map(c=>`<option>${c}</option>`).join('')); const filter=$('#movement-category-filter'); const existing=filter.value; filter.innerHTML='<option value="all">Todas las categorías</option>'+[...new Set(state.movements.map(m=>m.category))].sort().map(c=>`<option>${c}</option>`).join(''); filter.value=existing; }
function renderAll(){ populateCategories(); renderDashboard();renderTotalBalance();renderBackupReminder();renderCardAlerts();renderMovements();renderGoals();renderReminders();renderCapital();renderAccounts(); }
function open(id){ $(id).showModal(); }
function editBudget(budgetId){const budget=state.budgets.find(item=>item.id===budgetId);if(!budget)return;editingBudgetId=budgetId;const form=$('#budget-form');form.reset();form.elements.budgetId.value=budgetId;form.elements.category.value=budget.category;form.elements.kind.value=budget.kind||'variable';form.elements.period.value=budget.period||'monthly';form.elements.limit.value=budget.limit;$('#budget-dialog h2').textContent=`Editar límite · ${budget.category}`;$('#budget-form .submit-button').textContent='Guardar cambios';open('#budget-dialog');}
function editGoal(goalId){const goal=state.goals.find(item=>item.id===goalId);if(!goal)return;editingGoalId=goalId;const form=$('#goal-form');form.reset();form.elements.goalId.value=goalId;form.elements.name.value=goal.name;form.elements.target.value=goal.target;form.elements.current.value=goal.current;form.elements.linkType.value=goal.linkType||'none';populateGoalInvestmentChoices(goal.investmentId||'');populateGoalAccountChoices(goal.accountId||'');populateGoalOriginChoices(goal.originAccountId||'');if(form.elements.investmentId)form.elements.investmentId.value=goal.investmentId||'';syncGoalLink();$('#goal-dialog h2').textContent='Editar meta';$('#goal-form .submit-button').textContent='Guardar cambios';open('#goal-dialog');}
function editAccount(accountId){
  const account=state.accounts.find(item=>item.id===accountId);if(!account)return;
  editingAccountId=accountId;const form=$('#account-form');form.reset();form.elements.accountId.value=accountId;form.elements.name.value=account.name;form.elements.institution.value=account.institution||'';form.elements.kind.value=account.kind==='credit'?'credit':'debit';form.elements.initialBalance.value=Math.abs(Number(account.initialBalance)||0);form.elements.creditLimit.value=account.creditLimit||'';form.elements.cutDay.value=account.cutDay||'';form.elements.dueDay.value=account.dueDay||'';form.elements.alertCut.checked=Boolean(account.alerts?.cut);form.elements.alertDue.checked=account.alerts?Boolean(account.alerts.due):true;form.elements.alertDays.value=String(account.alerts?.days??3);syncAccountKind();form.elements.balanceDate.value=account.balanceDate||iso(today);setAccountYieldFields(account.yield);$('#account-dialog h2').textContent='Editar cuenta';$('#account-form .submit-button').textContent='Guardar cambios';open('#account-dialog');
}
function editInvestment(investmentId){
  const investment=state.investments.find(item=>item.id===investmentId);if(!investment)return;
  editingInvestmentId=investmentId;const form=$('#investment-form');form.reset();form.elements.investmentId.value=investmentId;
  ['institution','product','capital','rate','frequency','startDate','durationValue','durationUnit','monthlyContribution','taxRate','annualFee','annualFeeType','annualFeeAmount','interestCap','interestMode'].forEach(key=>{if(form.elements[key])form.elements[key].value=investment[key]??(key==='durationValue'?investment.durationMonths||12:key==='durationUnit'?'month':key==='interestMode'?'compound':key==='annualFeeType'?'percent':0);});
  form.elements.taxMode.value=investment.taxMode||'interest';populateRedirectInvestmentChoices(investment.redirectInvestmentId||'',investment.id);setInvestmentPlanFields(investment);$('#investment-term-unit').value=investment.durationUnit||'month';$('#investment-term-value').value=investment.durationValue||investment.durationMonths||12;$('#reflect-initial-label').hidden=true;syncTaxFeePresets();syncAnnualFeeType();$('#investment-dialog h2').textContent='Editar inversión';$('#investment-form .submit-button').textContent='Guardar cambios';open('#investment-dialog');
}
function prepareNewInvestment(){
  editingInvestmentId=null;const form=$('#investment-form');form.reset();form.elements.investmentId.value='';form.elements.startDate.value=iso(today);$('#investment-term-value').value='12';$('#investment-term-unit').value='month';form.elements.frequency.value='monthly';form.elements.monthlyContribution.value='0';form.elements.taxRate.value=String(MX_TAX_RATE);form.elements.taxMode.value='capital';form.elements.annualFee.value='0';form.elements.annualFeeType.value='percent';form.elements.annualFeeAmount.value='0';form.elements.interestCap.value='0';form.elements.interestMode.value='compound';populateRedirectInvestmentChoices();setInvestmentPlanFields();form.elements.reflectInitial.checked=Boolean(state.preferences.reflectInvestments);syncTaxFeePresets();syncAnnualFeeType();$('#reflect-initial-label').hidden=false;$('#investment-dialog h2').textContent='Agregar inversión';$('#investment-form .submit-button').textContent='Guardar inversión';open('#investment-dialog');
}
function editRecurringPlan(planId){const plan=state.recurringPlans.find(item=>item.id===planId);if(!plan)return;const form=$('#recurring-form');form.reset();form.elements.planId.value=plan.id;form.elements.type.value=plan.type;form.elements.kind.value=plan.kind||'fixed';form.elements.title.value=plan.title;form.elements.amount.value=plan.amount;form.elements.frequency.value=plan.frequency;form.elements.startDate.value=plan.startDate;$('#recurring-investment-label').hidden=plan.type!=='investment';populateRecurringInvestmentChoices();if(form.elements.investmentId)form.elements.investmentId.value=plan.toAccountId?`account-${plan.toAccountId}`:plan.investmentId||'';populateAccountChoices($('#recurring-account'),plan.accountId??'');syncRecurringAccountLabel();$('#recurring-dialog h2').textContent='Editar ingreso o gasto planeado';$('#recurring-form .submit-button').textContent='Guardar cambios';open('#recurring-dialog');}
function openOperationFor(investmentId=null){
  if(!state.investments.length){toast('Agrega primero una inversión.');return;}
  editingOperationId=null;editingOperationInvestmentId=null;const form=$('#investment-operation-form');form.reset();form.elements.operationId.value='';$('#operation-investment').disabled=false;$('#investment-operation-dialog h2').textContent='Aportación o retiro';$('#investment-operation-form .submit-button').textContent='Guardar operación';
  $('#operation-investment').innerHTML=state.investments.map(investment=>`<option value="${investment.id}">${escapeHtml(investment.institution)} · ${escapeHtml(investment.product)}</option>`).join('');
  if(investmentId!==null)$('#operation-investment').value=String(investmentId);
  form.elements.date.value=iso(today);$('#reflect-operation').checked=Boolean(state.preferences.reflectInvestments);populateAccountChoices($('#operation-account'),state.investments.find(item=>item.id===Number($('#operation-investment').value))?.accountId??defaultAccountId());syncOperationAccount();open('#investment-operation-dialog');
}
function editInvestmentOperation(investmentId,operationId){
  const investment=state.investments.find(item=>item.id===investmentId),operation=investment?.operations?.find(item=>item.id===operationId);if(!investment||!operation)return;
  openOperationFor(investmentId);editingOperationId=operationId;editingOperationInvestmentId=investmentId;
  const form=$('#investment-operation-form');$('#operation-investment').disabled=true;form.elements.operationId.value=operationId;form.elements.operationType.value=operation.type;form.elements.amount.value=operation.amount;form.elements.date.value=operation.date;form.elements.note.value=operation.note||'';form.elements.reflectInBalance.checked=Boolean(operation.reflectInBalance);populateAccountChoices($('#operation-account'),state.movements.find(item=>item.investmentOperationId===operation.id)?.accountId??'');syncOperationAccount();$('#investment-operation-dialog h2').textContent='Editar operación';$('#investment-operation-form .submit-button').textContent='Guardar cambios';
}
function applyTheme(theme){
  const dark=theme==='dark';
  document.body.dataset.theme=dark?'dark':'light';
  const button=$('#theme-button');
  button.textContent=dark?'Cambiar a claro':'Cambiar a oscuro';
  button.title=dark?'Activar modo claro':'Activar modo oscuro';
  button.setAttribute('aria-label',button.title);
  button.setAttribute('aria-pressed',String(dark));
  $('meta[name="theme-color"]').content=dark?'#101a18':'#146c5b';
}
function addInvestmentDetailsFields(){
  const form=$('#investment-form'),dateGroup=form.elements.startDate.closest('.two-cols');
  const feeLabel=form.elements.annualFee.closest('label');
  if(!form.elements.annualFeeType){feeLabel.innerHTML='Comisión anual<select name="feeChoice" id="fee-choice"><option value="0">0% · sin comisión (lo más común en cuentas de ahorro)</option><option value="0.5">0.5% al año sobre tu saldo</option><option value="1">1% al año sobre tu saldo</option><option value="custom">Otro porcentaje al año</option><option value="amount">Una cantidad fija al año (MXN)</option></select><input name="annualFeeType" type="hidden" value="percent" /><input name="annualFee" type="number" min="0" step="0.01" value="0" placeholder="% al año" /><input name="annualFeeAmount" id="fee-amount-field" type="number" min="0" step="0.01" value="0" placeholder="Monto al año en MXN" />';}
  if(!$('#investment-term-value')){const term=document.createElement('div');term.className='two-cols';term.id='investment-term';term.innerHTML='<label>Duración prevista<input id="investment-term-value" name="durationValue" type="number" min="1" max="36500" value="12" required /></label><label>Unidad del plazo<select id="investment-term-unit" name="durationUnit"><option value="day">Días</option><option value="month" selected>Meses</option><option value="year">Años</option></select></label>';dateGroup.insertAdjacentElement('afterend',term);}
  const feeGroup=form.elements.annualFee.closest('.two-cols');
  if(!form.elements.interestCap){const cap=document.createElement('label');cap.id='investment-cap-label';cap.innerHTML='Tope de capital que aportarás (MXN; 0 = sin tope)<input name="interestCap" type="number" min="0" step="0.01" value="0" />';feeGroup.insertAdjacentElement('afterend',cap);}
  if(!form.elements.redirectInvestmentId){const redirect=document.createElement('label');redirect.id='investment-redirect-label';redirect.innerHTML='Al alcanzar el tope, enviar las aportaciones sobrantes a<select name="redirectInvestmentId" id="redirect-investment"><option value="">No redirigir</option></select>';$('#investment-cap-label').insertAdjacentElement('afterend',redirect);}
  form.querySelectorAll('.form-help').forEach(help=>{if(help.textContent.includes('Los escenarios')||help.textContent.includes('ISR es'))help.remove();});
  if(!form.elements.interestMode){const mode=document.createElement('label');mode.id='investment-interest-mode-label';mode.innerHTML='Interés después de alcanzar el tope<select name="interestMode"><option value="compound">Reinvertir intereses (compuesto)</option><option value="simple">No reinvertir intereses (simple)</option></select>';$('#investment-cap-label').insertAdjacentElement('afterend',mode);}
  const helpText={capital:'Saldo que ya tienes al comenzar. No se cuenta como ingreso mensual.',rate:'La tasa es anual. Puedes escribir cualquier porcentaje; las sugerencias son ejemplos, no ofertas.',frequency:'Cada cuánto se añaden los intereses al saldo para calcular los siguientes intereses.',startDate:'Fecha desde la que se calcula el rendimiento.',monthlyContribution:'Aportación futura planeada cada mes; no se registra como operación real. Escribe 0 si no planeas aportar.',taxPreset:'Supuesto opcional de impuesto sobre rendimientos. Los ejemplos no determinan tu obligación fiscal; si no lo sabes, déjalo en 0.',annualFeeType:'Selecciona si la institución cobra un porcentaje del saldo o una cantidad fija en MXN por año. En la proyección se descuenta poco a poco durante el año.',durationValue:'Tiempo de la proyección. El saldo deja de proyectarse al llegar a este plazo.',interestCap:'Máximo de capital que podrás aportar en total. Al alcanzarlo se detienen nuevas aportaciones.',redirectInvestmentId:'Solo afecta a las aportaciones futuras planeadas. Cuando este producto se llena, el sobrante se agrega a la inversión elegida en la proyección.'};
  Object.entries(helpText).forEach(([name,text])=>{const input=form.elements[name];if(input){const label=input.closest('label');if(label&&!label.querySelector('.help-bubble'))addHelp(label,text);}});
  addHelp($('#investment-interest-mode-label'),'Compuesto: los intereses que se generan también producen intereses. Simple: después del tope, los intereses no se reinvierten.');
  addHelp($('#investment-term-unit').closest('label'),'Elige días, meses o años para el plazo indicado.');
  const opForm=$('#investment-operation-form');addHelp(opForm.elements.operationType.closest('label'),'Aportación: agrega capital al producto (sujeta al tope). Retiro: resta dinero del saldo.');addHelp(opForm.elements.reflectInBalance.closest('label'),'Solo crea un movimiento reflejado; los rendimientos del portafolio siguen aparte.');
  const goalForm=$('#goal-form');addHelp(goalForm.elements.linkType.closest('label'),'Vincular muestra el saldo o rendimiento como avance. No aparta dinero y el rendimiento puede variar.');
}
function populateRedirectInvestmentChoices(selected='',excludeId=''){const select=$('#redirect-investment');if(!select)return;select.innerHTML='<option value="">No redirigir</option>'+state.investments.filter(investment=>Number(investment.id)!==Number(excludeId)).map(investment=>`<option value="${investment.id}">${escapeHtml(investmentName(investment))}</option>`).join('');select.value=selected?String(selected):'';}
function addHelp(label,text){const button=document.createElement('button');button.type='button';button.className='help-bubble';button.textContent='?';button.setAttribute('aria-label','Ver explicación');button.setAttribute('aria-expanded','false');const popover=document.createElement('span');popover.className='help-popover';popover.textContent=text;popover.hidden=true;button.onclick=event=>{event.preventDefault();event.stopPropagation();const open=popover.hidden;closeHelpPopovers();popover.hidden=!open;button.setAttribute('aria-expanded',String(open));};const existingLine=label.querySelector(':scope > .label-line');if(existingLine){existingLine.append(button);existingLine.after(popover);return;}const titleNode=label.tagName==='LABEL'?[...label.childNodes].find(node=>node.nodeType===3&&node.textContent.trim()):null;if(titleNode){const line=document.createElement('span');line.className='label-line';titleNode.replaceWith(line);line.append(titleNode,button);line.after(popover);}else label.append(button,popover);}
function compactHelp(){
  const investment=$('#investment-form'),recurring=$('#recurring-form'),budget=$('#budget-form'),goal=$('#goal-form');
  [investment,recurring,budget,goal].forEach(form=>form.querySelectorAll('.form-help').forEach(node=>node.remove()));
  addHelp(investment.querySelector('.dialog-head'),'Registra saldo, tasa y plazo. Para operaciones posteriores usa “Aportar o retirar”.');
  addHelp(recurring.querySelector('.dialog-head'),'Fijo: monto esperado (nómina o renta). Variable: el monto es el tope por periodo. Solo es previsión; registra lo real en Movimientos.');
  addHelp(budget.querySelector('.dialog-head'),'Crea un límite para comparar con tus gastos reales por categoría.');
  addHelp(goal.querySelector('.dialog-head'),'El vínculo muestra un avance estimado; no aparta ni mueve dinero.');
  addHelp($('.capital-accounts .card-title'),'Tus cuentas de débito, ahorro y tarjetas de crédito. Las inversiones van en «Inversiones».');
  addHelp($('.projection-card .card-title'),'Proyección basada en tus tasas y plazos; es una estimación, no una garantía.');
  addHelp($('#presupuestos .section-heading h2'),'Los planes muestran lo que esperas recibir o pagar. Los límites comparan gastos reales con el máximo definido.');
}
function populateGoalInvestmentChoices(selected=''){const select=$('#goal-investment');select.innerHTML=state.investments.map(investment=>`<option value="${investment.id}">${escapeHtml(investment.institution)} · ${escapeHtml(investment.product)}</option>`).join('');if(selected)select.value=String(selected);}
function syncGoalLink(){
  const form=$('#goal-form'),type=form.elements.linkType.value;
  $('#goal-investment-label').hidden=type!=='investment'&&type!=='interest';
  $('#goal-account-label').hidden=type!=='account';
  $('#goal-origin-label').hidden=type!=='account'&&type!=='investment';populateGoalOriginChoices();
  const currentLabel=form.elements.current.closest('label'),title=currentLabel.querySelector('.label-line')?[...currentLabel.querySelector('.label-line').childNodes].find(node=>node.nodeType===3):[...currentLabel.childNodes].find(node=>node.nodeType===3&&node.textContent.trim());
  if(title)title.textContent=type==='none'?'Ya ahorrado':'Ahorro adicional (fuera de lo vinculado)';
  const warning=$('#goal-account-warning'),accountId=Number(form.elements.accountId?.value),editing=Number(form.elements.goalId.value),other=type==='account'?state.goals.find(goal=>goal.id!==editing&&goal.linkType==='account'&&Number(goal.accountId)===accountId):null;
  warning.hidden=!other&&!(type==='account'&&!state.accounts.some(account=>account.kind!=='credit'));
  warning.textContent=type==='account'&&!state.accounts.some(account=>account.kind!=='credit')?'Aún no tienes cuentas de banco. Agrégalas en «Cuentas».':other?`Atención: la meta «${other.name}» ya usa esta cuenta. El mismo dinero se contaría en las dos metas.`:'';
}
function populateGoalAccountChoices(selected=''){const select=$('#goal-account');select.innerHTML=state.accounts.filter(account=>account.kind!=='credit').map(account=>`<option value="${account.id}">${escapeHtml(accountLabel(account.id))} · ${money.format(accountBalanceToday(account))}</option>`).join('');if(selected)select.value=String(selected);select.onchange=syncGoalLink;}
function syncTaxFeePresets(){syncTaxPreset();const form=$('#investment-form');[['feePreset','annualFee']].forEach(([presetName,valueName])=>{const preset=form.elements[presetName],input=form.elements[valueName];if(!preset||!input)return;const matching=[...preset.options].find(option=>option.value!=='custom'&&Number(option.value)===Number(input.value));preset.value=matching?matching.value:'custom';input.hidden=preset.value!=='custom';preset.onchange=()=>{if(preset.value==='custom'){input.hidden=false;input.focus();}else{input.value=preset.value;input.hidden=true;}};});}
function editMovement(movementId){
  const movement=state.movements.find(item=>item.id===movementId);
  if(!movement)return;
  editingMovementId=movementId;
  const form=$('#movement-form');
  form.reset();
  $('#movement-type').value=movement.type;
  populateCategories();
  form.elements.title.value=movement.title;
  form.elements.amount.value=movement.amount;
  form.elements.date.value=movement.date;
  form.elements.category.value=movement.category;
  form.elements.note.value=movement.note||'';
  populateAccountChoices($('#movement-account'),movement.accountId??'');
  populateMovementInvestment(false);
  $('#movement-dialog .dialog-head h2').textContent='Editar movimiento';
  $('#movement-form .submit-button').textContent='Guardar cambios';
  open('#movement-dialog');
}
function setup(){
  addInvestmentDetailsFields();
  addRecurringInvestmentSelect();
  compactHelp();
  populateGoalInvestmentChoices();syncGoalLink();$('#goal-form').elements.linkType.onchange=syncGoalLink;
  applyTheme(localStorage.getItem(THEME_STORE)||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',event=>{if(!localStorage.getItem(THEME_STORE))applyTheme(event.matches?'dark':'light');});
  $('#theme-button').onclick=()=>{const next=document.body.dataset.theme==='dark'?'light':'dark';localStorage.setItem(THEME_STORE,next);applyTheme(next);};
  $('#reflect-default').checked=Boolean(state.preferences.reflectInvestments);
  $('#reflect-default').onchange=()=>{state.preferences.reflectInvestments=$('#reflect-default').checked;save();toast('Preferencia actualizada.');};
  document.addEventListener('click',e=>{const link=e.target.closest('a[href^="#"]');if(!link)return;const page=link.getAttribute('href').slice(1);if(!document.getElementById(page)?.classList.contains('page'))return;e.preventDefault();goToPage(page);});
  $all('.close-dialog').forEach(button=>{button.type='button';button.onclick=()=>button.closest('dialog').close();});
  $('#menu-button').onclick=()=>$('.sidebar').classList.toggle('open'); $all('.open-movement').forEach(b=>b.onclick=()=>{ editingMovementId=null;$('#movement-form').reset();$('#movement-form [name=date]').value=iso(today);populateCategories();populateAccountChoices($('#movement-account'),defaultAccountId());populateMovementInvestment(true);$('#movement-dialog .dialog-head h2').textContent='Agregar movimiento';$('#movement-form .submit-button').textContent='Guardar movimiento';open('#movement-dialog'); });
  $('#open-account').onclick=()=>{editingAccountId=null;$('#account-form').reset();$('#account-form').elements.accountId.value='';$('#account-form').elements.balanceDate.value=iso(today);setAccountYieldFields(null);syncAccountKind();$('#account-dialog h2').textContent='Agregar cuenta';$('#account-form .submit-button').textContent='Guardar cuenta';open('#account-dialog');};
  $('#open-investment').onclick=prepareNewInvestment;
  $('#open-recurring').onclick=()=>{const form=$('#recurring-form');form.reset();form.elements.planId.value='';form.elements.startDate.value=iso(today);form.elements.kind.value='fixed';$('#recurring-investment-label').hidden=true;$('#recurring-dialog h2').textContent='Ingreso o gasto planeado';$('#recurring-form .submit-button').textContent='Guardar plan';populateRecurringInvestmentChoices();populateAccountChoices($('#recurring-account'),defaultAccountId());syncRecurringAccountLabel();open('#recurring-dialog');};
  $('#investment-form').elements.taxRate.oninput=()=>{const form=$('#investment-form');if(!form.elements.taxPreset.value.startsWith('custom'))form.elements.taxPreset.value=form.elements.taxMode.value==='capital'?'custom-capital':'custom-interest';};
  $('#open-investment-operation').onclick=()=>openOperationFor();
  $('#movement-type').onchange=populateCategories; $('#open-budget').onclick=()=>{editingBudgetId=null;const form=$('#budget-form');form.reset();form.elements.budgetId.value='';populateCategories();$('#budget-dialog h2').textContent='Nuevo límite';$('#budget-form .submit-button').textContent='Guardar';open('#budget-dialog');}; $('#open-goal').onclick=()=>{editingGoalId=null;const form=$('#goal-form');form.reset();form.elements.goalId.value='';form.elements.linkType.value='none';populateGoalInvestmentChoices();populateGoalAccountChoices();syncGoalLink();$('#goal-dialog h2').textContent='Nueva meta';$('#goal-form .submit-button').textContent='Guardar';open('#goal-dialog');}; $('#open-reminder').onclick=()=>{ editingReminderId=null;$('#reminder-form').reset();$('#reminder-form [name=date]').value=iso(today);$('#reminder-dialog h2').textContent='Nuevo recordatorio';$('#reminder-form .submit-button').textContent='Crear recordatorio';open('#reminder-dialog'); };
  $('#movement-form').addEventListener('submit',e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));data.accountId=data.accountId?Number(data.accountId):null;if(data.accountId)state.preferences.lastAccountId=data.accountId;const targetInvestment=data.type==='investment'&&editingMovementId===null?state.investments.find(item=>item.id===Number(data.investmentTarget)):null;delete data.investmentTarget;if(targetInvestment){const cap=Number(targetInvestment.interestCap)||0;if(cap&&investmentPrincipal(targetInvestment)+Number(data.amount)>cap){toast(`El tope de esa inversión es ${money.format(cap)}. Puedes aportar hasta ${money.format(Math.max(0,cap-investmentPrincipal(targetInvestment)))}.`);return;}const operation={id:id(),type:'contribution',amount:Number(data.amount),date:data.date,note:data.note||'',reflectInBalance:true};targetInvestment.operations=targetInvestment.operations||[];targetInvestment.operations.push(operation);state.movements.push({id:id(),...data,amount:Number(data.amount),investmentId:targetInvestment.id,investmentOperationId:operation.id});save();$('#movement-dialog').close();renderAll();toast('Aportación guardada en Movimientos y en tu inversión.');return;}if(editingMovementId!==null){const movement=state.movements.find(item=>item.id===editingMovementId);if(movement)Object.assign(movement,data,{amount:Number(data.amount)});editingMovementId=null;}else state.movements.push({id:id(),...data,amount:Number(data.amount)});save();$('#movement-dialog').close();renderAll();toast('Movimiento guardado correctamente.');});
  $('#account-form').addEventListener('submit',e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));delete data.accountId;data.kind=data.kind==='credit'?'credit':'debit';if(data.kind==='credit'){data.initialBalance=-Math.abs(Number(data.initialBalance)||0);data.creditLimit=Number(data.creditLimit)||0;data.hasYield='';const day=value=>{const n=Math.round(Number(value));return n>=1&&n<=31?n:null;};data.cutDay=day(data.cutDay);data.dueDay=day(data.dueDay);data.alerts={cut:data.alertCut==='on',due:data.alertDue==='on',days:Number(data.alertDays)||0};}else{data.initialBalance=Math.abs(Number(data.initialBalance)||0);data.creditLimit=0;data.cutDay=null;data.dueDay=null;data.alerts=null;}['alertCut','alertDue','alertDays'].forEach(key=>delete data[key]);data.yield=data.hasYield==='on'&&Number(data.yieldRate)>0?{rate:Number(data.yieldRate),frequency:data.yieldFrequency||'daily',cap:Number(data.yieldCap)||0,taxRate:data.yieldTax==='mx'?MX_TAX_RATE:0}:null;if(data.kind!=='credit'&&data.hasYield==='on'&&!(Number(data.yieldRate)>0)){toast('Escribe la tasa anual que te paga esta cuenta.');return;}['hasYield','yieldRate','yieldFrequency','yieldCap','yieldTax'].forEach(key=>delete data[key]);data.balanceDate=data.balanceDate||iso(today);if(editingAccountId!==null){const account=state.accounts.find(item=>item.id===editingAccountId);if(account)Object.assign(account,data);editingAccountId=null;}else state.accounts.push({id:id(),...data});save();$('#account-dialog').close();renderAll();toast('Cuenta guardada.');});
  $('#investment-form').addEventListener('submit',e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));const reflectInitial=data.reflectInitial==='on';delete data.investmentId;delete data.reflectInitial;delete data.taxPreset;delete data.feePreset;delete data.feeChoice;const planMode=data.contributionMode;delete data.contributionMode;if(planMode!=='income')data.fundingPlanId='';if(planMode!=='monthly')data.monthlyContribution=0;if(planMode==='income'&&!data.fundingPlanId){toast('Elige de qué ingreso recurrente sale el dinero.');return;}data.accountId=data.accountId?Number(data.accountId):null;['capital','rate','durationValue','monthlyContribution','taxRate','annualFee','annualFeeAmount','interestCap','fundingAmount'].forEach(key=>data[key]=Number(data[key]||0));data.fundingPlanId=data.fundingPlanId?Number(data.fundingPlanId):null;if(data.fundingPlanId){const source=state.recurringPlans.find(plan=>plan.id===data.fundingPlanId);if(data.fundingAmount<=0){toast('Escribe cuánto apartarás de ese ingreso cada vez.');return;}if(source&&data.fundingAmount>Number(source.amount)){toast(`No puedes apartar más que el monto del ingreso (${money.format(source.amount)}).`);return;}}else data.fundingAmount=0;data.redirectInvestmentId=data.redirectInvestmentId?Number(data.redirectInvestmentId):null;if(data.interestCap>0&&data.capital>data.interestCap){toast('El capital inicial no puede superar el tope de aportaciones.');return;}if(editingInvestmentId!==null){if(Number(data.redirectInvestmentId)===Number(editingInvestmentId))data.redirectInvestmentId=null;const investment=state.investments.find(item=>item.id===editingInvestmentId);if(investment){Object.assign(investment,data);const initialMovement=state.movements.find(item=>item.investmentId===investment.id&&item.investmentOperationId==='initial');if(initialMovement)Object.assign(initialMovement,{amount:investment.capital,date:investment.startDate,title:`Capital inicial · ${investment.institution} · ${investment.product}`});}editingInvestmentId=null;}else{const investment={id:id(),...data,operations:[]};state.investments.push(investment);if(reflectInitial&&investment.capital>0)state.movements.push({id:id(),type:'investment',investmentId:investment.id,investmentOperationId:'initial',title:`Capital inicial · ${investment.institution} · ${investment.product}`,amount:investment.capital,category:'Inversiones',date:investment.startDate,note:'Aportación inicial reflejada desde el portafolio.'});}save();$('#investment-dialog').close();populateGoalInvestmentChoices();renderAll();toast('Inversión guardada.');});
  $('#investment-operation-form').addEventListener('submit',e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(e.target));
    const investment=state.investments.find(item=>item.id===(editingOperationInvestmentId??Number(data.investmentId)));
    if(!investment)return;
    const operationAmount=Number(data.amount),operationType=data.operationType,reflect=data.reflectInBalance==='on';
    const existing=(investment.operations||[]).find(item=>item.id===editingOperationId);
    const available=investmentMetrics(investment).value+(existing?(existing.type==='withdrawal'?Number(existing.amount):-Number(existing.amount)):0);
    if(operationType==='withdrawal'&&operationAmount>available){toast('El retiro supera el valor estimado de esta inversión.');return;}
    if(operationType==='contribution'&&Number(investment.interestCap)>0){const principal=Math.max(0,Number(investment.capital||0)+(investment.operations||[]).filter(op=>op!==existing).reduce((sum,op)=>sum+(op.type==='contribution'?1:-1)*Number(op.amount),0));if(principal+operationAmount>Number(investment.interestCap)){toast(`El tope es ${money.format(investment.interestCap)}. Puedes aportar hasta ${money.format(Math.max(0,Number(investment.interestCap)-principal))} más.`);return;}}
    investment.operations=investment.operations||[];
    let operation;
    if(existing){operation=existing;Object.assign(operation,{type:operationType,amount:operationAmount,date:data.date,note:data.note||'',reflectInBalance:reflect});}
    else{operation={id:id(),type:operationType,amount:operationAmount,date:data.date,note:data.note||'',reflectInBalance:reflect};investment.operations.push(operation);}
    let movement=state.movements.find(item=>item.investmentOperationId===operation.id);
    if(reflect){
      if(!movement){movement={id:id(),investmentId:investment.id,investmentOperationId:operation.id};state.movements.push(movement);}
      Object.assign(movement,{accountId:data.accountId?Number(data.accountId):null,type:operationType==='contribution'?'investment':'income',title:`${operationType==='contribution'?'Aportación':'Retiro'} · ${investment.institution} · ${investment.product}`,amount:operationAmount,category:'Inversiones',date:data.date,note:data.note||'Operación reflejada desde el portafolio.'});
    }else if(movement)state.movements=state.movements.filter(item=>item.investmentOperationId!==operation.id);
    editingOperationId=null;editingOperationInvestmentId=null;save();$('#investment-operation-dialog').close();renderAll();toast('Operación guardada.');
  });
  $('#investment-operation-form').elements.operationType.onchange=()=>{const contribution=$('#investment-operation-form').elements.operationType.value==='contribution',investment=state.investments.find(item=>item.id===Number($('#investment-operation-form').elements.investmentId.value)),cap=Number(investment?.interestCap||0);$('#investment-operation-form .submit-button').textContent=contribution&&cap?'Guardar aportación (sujeta al tope)':'Guardar operación';};
  $('#budget-form').addEventListener('submit',e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),budgetId=Number(d.budgetId);delete d.budgetId;d.limit=Number(d.limit);const existing=state.budgets.find(item=>item.id===budgetId),duplicate=state.budgets.find(item=>item.category===d.category&&item.id!==budgetId);if(duplicate){toast(`Ya existe un límite para ${d.category}.`);return;}if(existing)Object.assign(existing,d);else state.budgets.push({id:id(),...d});editingBudgetId=null;save();$('#budget-dialog').close();renderAll();toast(existing?'Límite actualizado.':'Límite guardado.');});
  $('#recurring-form').addEventListener('submit',e=>{e.preventDefault();const plan=Object.fromEntries(new FormData(e.target)),planId=Number(plan.planId);delete plan.planId;plan.amount=Number(plan.amount);const destination=String(plan.investmentId||'');plan.toAccountId=plan.type==='investment'&&destination.startsWith('account-')?Number(destination.slice(8)):null;plan.investmentId=plan.type==='investment'&&destination&&!destination.startsWith('account-')?Number(destination):null;if(plan.type==='investment'&&plan.toAccountId&&plan.toAccountId===plan.accountId){toast('El dinero no puede salir y llegar a la misma cuenta.');return;}plan.accountId=plan.accountId?Number(plan.accountId):null;const existing=state.recurringPlans.find(item=>item.id===planId);if(existing)Object.assign(existing,plan);else state.recurringPlans.push({id:id(),...plan});save();$('#recurring-dialog').close();renderAll();toast(existing?'Plan actualizado.':'Plan guardado; no se agregó a tus movimientos reales.');});
  $('#goal-form').addEventListener('submit',e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),goalId=Number(d.goalId);delete d.goalId;d.target=Number(d.target);d.current=Number(d.current);d.investmentId=d.investmentId?Number(d.investmentId):null;d.accountId=d.linkType==='account'&&d.accountId?Number(d.accountId):null;d.originAccountId=(d.linkType==='account'||d.linkType==='investment')&&d.originAccountId?Number(d.originAccountId):null;if(d.originAccountId&&d.originAccountId===d.accountId){toast('El dinero no puede salir y llegar a la misma cuenta.');return;}if(d.linkType==='account'&&!d.accountId){toast('Primero agrega una cuenta de banco en «Cuentas».');return;}const existing=state.goals.find(item=>item.id===goalId);if(existing)Object.assign(existing,d);else state.goals.push({id:id(),...d});editingGoalId=null;save();$('#goal-dialog').close();renderAll();toast(existing?'Meta actualizada.':'Meta guardada.');});
  $('#reminder-form').addEventListener('submit',e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const existingReminder=state.reminders.find(item=>item.id===editingReminderId);if(existingReminder){if(existingReminder.date!==d.date){const sent=JSON.parse(localStorage.getItem(`${STORE}-notified`)||'{}');delete sent[existingReminder.id];localStorage.setItem(`${STORE}-notified`,JSON.stringify(sent));}Object.assign(existingReminder,d);}else state.reminders.push({id:id(),...d});editingReminderId=null;save();$('#reminder-dialog').close();renderAll();checkDueReminders();toast('Recordatorio guardado.');});
  $('#movement-type-filter').onchange=renderMovements; $('#movement-category-filter').onchange=renderMovements;
  const notificationButton=$('#notification-button');if(!('Notification'in window)){notificationButton.textContent='No disponibles';notificationButton.disabled=true;}else if(Notification.permission==='granted')notificationButton.textContent='Notificaciones activas';notificationButton.onclick=async()=>{if(!('Notification'in window)){toast('Este navegador no admite notificaciones.');return;}if(Notification.permission==='granted'){toast('Los avisos se mostrarán al abrir la app.');checkDueReminders();return;}const result=await Notification.requestPermission();notificationButton.textContent=result==='granted'?'Notificaciones activas':'Activar notificaciones';toast(result==='granted'?'Avisos activados. Se revisarán al abrir la app.':'No se activaron los avisos.');if(result==='granted')checkDueReminders();};
  $('#export-button').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`claro-respaldo-${iso(today)}.json`;a.click();URL.revokeObjectURL(a.href);state.preferences.lastBackup=iso(new Date());save();renderBackupReminder();toast('Respaldo descargado. Guárdalo en un lugar seguro (por ejemplo, Drive o tu correo).');};
  $('#reset-button').onclick=()=>{if(confirm('¿Quieres borrar todos los movimientos, presupuestos, metas, recordatorios, cuentas e inversiones guardados en este dispositivo? Esta acción no se puede deshacer.')){state=structuredClone(emptyState);syncMoneyChartControls();$('#projection-horizon').value='12';save();$('#reflect-default').checked=state.preferences.reflectInvestments;renderAll();toast('Se borraron los datos de este dispositivo.');}};
  $('#import-button').onclick=()=>$('#import-file').click();
  $('#import-file').onchange=async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;try{const data=JSON.parse(await file.text());const lists=['movements','budgets','goals','reminders','accounts','investments','recurringPlans'];if(!data||typeof data!=='object'||Array.isArray(data)||!lists.some(key=>Array.isArray(data[key]))||lists.some(key=>key in data&&!Array.isArray(data[key]))){toast('Ese archivo no parece un respaldo de Claro.');return;}if(!confirm('¿Cargar este respaldo? Reemplazará los datos que tienes ahora en este dispositivo.'))return;const previous=localStorage.getItem(STORE);localStorage.setItem(STORE,JSON.stringify(data));const loaded=load();if(!loaded.movements.every(m=>m&&typeof m.date==='string')){if(previous===null)localStorage.removeItem(STORE);else localStorage.setItem(STORE,previous);toast('El respaldo tiene datos dañados; no se cargó.');return;}state=loaded;migrateData();syncMoneyChartControls();$('#projection-horizon').value=state.preferences.projectionHorizon||'12';save();$('#reflect-default').checked=state.preferences.reflectInvestments;renderAll();checkDueReminders();toast('Respaldo cargado.');}catch{toast('No se pudo leer el archivo de respaldo.');}};
  if(navigator.storage&&navigator.storage.persist)navigator.storage.persisted().then(already=>already||navigator.storage.persist()).catch(()=>{});
  migrateData();setupMoneyChartControls();setupFundingFields();setupRecurringAccount();setupOverlapWarnings();setupAccountYield();$('#account-form').elements.kind.onchange=syncAccountKind;$('#recurring-form').elements.kind.closest('label').hidden=true;$('#budget-form').elements.kind.closest('label').hidden=true;setupMovementInvestment();setupRepay();applyFriendlyHelp();
  $('#reflect-operation').addEventListener('change',syncOperationAccount);
  $('#accounts-horizon').value=String(state.preferences.accountsHorizon||3);$('#accounts-horizon').onchange=()=>{state.preferences.accountsHorizon=Number($('#accounts-horizon').value);save();renderAccountsChart();};
  $('#projection-horizon').value=state.preferences.projectionHorizon||'12';$('#projection-horizon').onchange=()=>{state.preferences.projectionHorizon=$('#projection-horizon').value;selectedPortfolioPointIndex=0;save();renderCapital();};
  registerServiceWorker();renderAll();checkDueReminders();
  const startPage=location.hash.slice(1);if(startPage&&document.getElementById(startPage)?.classList.contains('page'))goToPage(startPage,false);
}
function registerServiceWorker(){
  if(!('serviceWorker'in navigator))return;
  let reloading=false;const hadController=Boolean(navigator.serviceWorker.controller);
  // Al llegar una versión nueva, la app se recarga sola; si estás llenando un formulario, te deja un botón para hacerlo cuando quieras.
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading||!hadController)return;if(document.querySelector('dialog[open]')){$('#update-banner').hidden=false;$('#update-button').onclick=()=>{reloading=true;location.reload();};return;}reloading=true;location.reload();});
  navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).then(registration=>{
    if(registration.waiting)registration.waiting.postMessage('SKIP_WAITING');
    const check=()=>registration.update().catch(()=>{});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
    setInterval(check,30*60*1000);
  }).catch(()=>{});
}
function showReminder(title,body){
  const options={body,icon:'icon-192.png',badge:'icon-192.png',tag:`claro-${title}-${body}`};
  if('serviceWorker'in navigator)return navigator.serviceWorker.getRegistration().then(registration=>registration?registration.showNotification(title,options):new Notification(title,options)).catch(()=>{try{new Notification(title,options);}catch{}});
  try{new Notification(title,options);}catch{}
}
function checkDueReminders(){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  const date=iso(today),sent=JSON.parse(localStorage.getItem(`${STORE}-notified`)||'{}');
  state.reminders.filter(reminder=>(reminderRepeats(reminder)?reminderNextDate(reminder)===date:reminder.date<=date)&&sent[reminder.id]!==date).forEach(reminder=>{
    showReminder(reminder.date===date||reminderRepeats(reminder)?'Recordatorio para hoy':'Recordatorio pendiente',reminder.title);
    sent[reminder.id]=date;
  });
  cardEvents().filter(event=>event.alert&&event.daysLeft<=event.alertDays&&sent[event.key]!==event.date).forEach(event=>{showReminder(event.daysLeft===0?`Hoy: ${event.label.toLowerCase()}`:`${event.label} en ${event.daysLeft} ${event.daysLeft===1?'día':'días'}`,`${accountLabel(event.account.id)} · ${displayDate(event.date)}${event.type==='due'?` · saldo ${money.format(accountBalanceToday(event.account))}`:''}`);sent[event.key]=event.date;});
  localStorage.setItem(`${STORE}-notified`,JSON.stringify(sent));
}
function goToPage(page,scroll=true){
  const link=$(`.nav-link[data-page="${page}"]`);
  $all('.page').forEach(section=>section.classList.toggle('active',section.id===page));
  $all('.nav-link').forEach(item=>item.classList.toggle('active',item===link));
  if(link)$('#page-title').textContent=link.textContent.trim();
  $('.sidebar').classList.remove('open');
  try{history.replaceState(null,'',page==='inicio'?location.pathname:`#${page}`);}catch{}
  if(scroll)window.scrollTo({top:0,behavior:'smooth'});
}
function syncAnnualFeeType(){
  const form=$('#investment-form'),choice=form.elements.feeChoice;if(!choice)return;
  const type=form.elements.annualFeeType,rate=form.elements.annualFee,amount=form.elements.annualFeeAmount,value=Number(rate.value)||0;
  choice.value=type.value==='amount'?'amount':[0,0.5,1].includes(value)?String(value):'custom';
  const apply=()=>{const option=choice.value;type.value=option==='amount'?'amount':'percent';if(!['custom','amount'].includes(option))rate.value=option;rate.hidden=option!=='custom';amount.hidden=option!=='amount';};
  choice.onchange=()=>{apply();if(choice.value==='custom')rate.focus();if(choice.value==='amount')amount.focus();};apply();
  const cap=form.elements.interestCap,capExtras=()=>{const hasCap=Number(cap.value)>0;$('#investment-interest-mode-label').hidden=!hasCap;$('#investment-redirect-label').hidden=!hasCap;};cap.oninput=capExtras;capExtras();
}
function syncInvestmentBank(){
  const select=$('#investment-account'),institution=$('#investment-form').elements.institution,account=state.accounts.find(item=>item.id===Number(select.value));
  if(account)institution.value=(account.institution||account.name||'').trim();
  else if(!select.closest('label').hidden&&state.accounts.some(item=>(item.institution||item.name||'').trim()===institution.value))institution.value='';
  institution.closest('label').hidden=Boolean(account);
}

/* Cuentas */
function accountLabel(accountId){
  if(accountId===null||accountId===undefined||accountId==='')return '';
  const account=state.accounts.find(item=>item.id===Number(accountId));
  return account?`${account.institution?`${account.institution} · ${account.name}`:account.name}${account.kind==='credit'?' (crédito)':''}`:'';
}
function defaultAccountId(){
  const last=state.accounts.find(account=>account.id===Number(state.preferences.lastAccountId));
  return last?last.id:(state.accounts[0]?.id??'');
}
function populateAccountChoices(select,selected=''){
  if(!select)return;
  select.innerHTML='<option value="">Sin cuenta</option>'+state.accounts.filter(account=>select.id!=='investment-account'||account.kind!=='credit').map(account=>`<option value="${account.id}">${escapeHtml(accountLabel(account.id))}</option>`).join('');
  select.value=selected!==''&&selected!==null&&selected!==undefined&&state.accounts.some(account=>account.id===Number(selected))?String(selected):'';
  if(select.id==='investment-account')select.options[0].textContent='Otra institución (escríbela abajo)';
  if(['movement-account','recurring-account','investment-account'].includes(select.id))select.closest('label').hidden=!state.accounts.length;
}
function accountEndOfMonthNote(account){const info=monthInfo();if(info.todayDay>=info.days)return '';const end=accountProjectedOn(account,info.dayIso(info.days)),now=accountBalanceToday(account);return Math.abs(end-now)>=1?` · fin de mes estimado ${money.format(end)}`:'';}
function accountMovements(account){return state.movements.filter(movement=>Number(movement.accountId)===account.id||(movement.type==='transfer'&&Number(movement.toAccountId)===account.id)).map(movement=>movement.type==='transfer'&&Number(movement.toAccountId)===account.id&&Number(movement.accountId)!==account.id?{...movement,type:'income'}:movement);}
function accountBalanceToday(account){return accountBalanceOn(account,iso(today),accountMovements(account));}
function planDatesBetween(plan,fromIso,toIso){
  const dates=[],limit=Number(plan.occurrences)>0?Number(plan.occurrences):Infinity;let date=new Date(`${plan.startDate}T12:00:00`),index=0,guard=0;
  while(iso(date)<=toIso&&index<limit&&guard++<3000){if(iso(date)>fromIso)dates.push(iso(date));date=nextOccurrence(date,plan.frequency);index++;}
  return dates;
}
/* Dinero planeado que entra o sale de una cuenta: nómina que llega, renta que se paga, aportaciones que salen hacia una inversión. */
function accountPlanFlows(account,toIso){
  const fromIso=iso(today),flows=[];
  state.recurringPlans.filter(plan=>plan.type==='investment'&&Number(plan.toAccountId)===account.id).forEach(plan=>planDatesBetween(plan,fromIso,toIso).forEach(date=>flows.push({date,amount:Number(plan.amount)})));
  state.recurringPlans.filter(plan=>Number(plan.accountId)===account.id).forEach(plan=>planDatesBetween(plan,fromIso,toIso).forEach(date=>flows.push({date,amount:plan.type==='income'?Number(plan.amount):-Number(plan.amount)})));
  fundingPlans().forEach(plan=>{const investment=state.investments.find(item=>item.id===plan.investmentId),source=state.recurringPlans.find(item=>item.id===plan.sourcePlanId),from=Number(source?.accountId||investment?.accountId||0);if(from===account.id)planDatesBetween(plan,fromIso,toIso).forEach(date=>flows.push({date,amount:-plan.amount}));});
  return flows;
}
function accountProjectedOn(account,dateIso){if(account.yield&&dateIso>(account.balanceDate||iso(today)))return accountYieldBalance(account,dateIso,accountMovements(account),accountPlanFlows(account,dateIso));return accountBalanceToday(account)+accountPlanFlows(account,dateIso).reduce((sum,flow)=>sum+flow.amount,0);}
function syncOperationAccount(){$('#operation-account-label').hidden=!state.accounts.length||!$('#reflect-operation').checked;}
function setupRecurringAccount(){
  const form=$('#recurring-form'),label=document.createElement('label');
  label.id='recurring-account-label';
  label.innerHTML='<span class="recurring-account-title">¿A qué cuenta llega?</span><select name="accountId" id="recurring-account"></select>';
  $('#recurring-investment-label').insertAdjacentElement('afterend',label);
  form.elements.type.addEventListener('change',syncRecurringAccountLabel);
  syncRecurringAccountLabel();
}
function syncRecurringAccountLabel(){const type=$('#recurring-form').elements.type.value;$('.recurring-account-title').textContent=type==='income'?'¿A qué cuenta llega?':'¿De qué cuenta sale?';}
function migrateData(){
  let changed=false;
  state.accounts.forEach(account=>{if(!account.balanceDate){account.balanceDate=iso(today);changed=true;}});
  chartPrefs();
  if(changed)save();
}

/* Inversiones pagadas con un ingreso recurrente */
function fundingSource(investment){
  if(!investment.fundingPlanId||!(Number(investment.fundingAmount)>0))return null;
  return state.recurringPlans.find(plan=>plan.id===Number(investment.fundingPlanId)&&plan.type==='income')||null;
}
function fundingPlans(){
  return state.investments.map(investment=>{const source=fundingSource(investment);return source?{id:`funding-${investment.id}`,type:'investment',investmentId:investment.id,sourcePlanId:source.id,amount:Number(investment.fundingAmount),frequency:source.frequency,startDate:source.startDate,occurrences:source.occurrences,title:`Aportación a ${investmentName(investment)}`}:null;}).filter(Boolean);
}
function investmentPlans(){return [...(state.recurringPlans||[]).filter(plan=>plan.type==='investment'&&plan.investmentId),...fundingPlans()];}
function fundedByPlan(planId){return state.investments.filter(investment=>fundingSource(investment)?.id===Number(planId));}
function setupFundingFields(){
  const form=$('#investment-form'),monthlyLabel=form.elements.monthlyContribution.closest('label'),anchor=monthlyLabel.closest('.two-cols'),wrap=document.createElement('div');
  wrap.className='funding-fields';
  wrap.innerHTML='<label id="investment-plan-mode-label">Aportaciones futuras<select name="contributionMode" id="investment-plan-mode"><option value="none">Sin aportaciones adicionales</option><option value="monthly">Una cantidad fija cada mes</option><option value="income">Apartar de un ingreso recurrente (ej. nómina)</option></select></label><label id="investment-funding-label">¿De qué ingreso?<select name="fundingPlanId" id="investment-funding"></select></label><label id="investment-funding-amount-label">Monto a apartar cada vez que lo recibas (MXN)<input name="fundingAmount" type="number" min="0" step="0.01" value="0" /></label>';
  anchor.insertAdjacentElement('afterend',wrap);
  const institutionLabel=form.elements.institution.closest('label'),bankLabel=document.createElement('label');bankLabel.id='investment-account-label';bankLabel.innerHTML='Banco o institución<select name="accountId" id="investment-account"></select>';institutionLabel.insertAdjacentElement('beforebegin',bankLabel);const institutionTitle=[...institutionLabel.childNodes].find(node=>node.nodeType===3&&node.textContent.trim());if(institutionTitle)institutionTitle.textContent='Nombre de la institución';$('#investment-account').onchange=syncInvestmentBank;
  const title=monthlyLabel.querySelector('.label-line')?.firstChild||[...monthlyLabel.childNodes].find(node=>node.nodeType===3&&node.textContent.trim());if(title)title.textContent='Cuánto aportar cada mes (MXN)';
  $('#investment-plan-mode-label').insertAdjacentElement('afterend',monthlyLabel);
  anchor.classList.remove('two-cols');
  $('#investment-plan-mode').onchange=syncFunding;
  $('#investment-funding').onchange=()=>{const source=state.recurringPlans.find(plan=>plan.id===Number($('#investment-funding').value));syncFunding();};
  populateFundingChoices();syncFunding();
}
function populateFundingChoices(selected=''){
  const select=$('#investment-funding'),incomes=state.recurringPlans.filter(plan=>plan.type==='income'),labels={weekly:'semanal',biweekly:'quincenal',monthly:'mensual',yearly:'anual'};
  select.innerHTML=incomes.length?incomes.map(plan=>`<option value="${plan.id}">${escapeHtml(plan.title)} · ${money.format(plan.amount)} ${labels[plan.frequency]||''}${accountLabel(plan.accountId)?` → ${escapeHtml(accountLabel(plan.accountId))}`:''}</option>`).join(''):'<option value="">Primero agrega un ingreso en Presupuestos → Plan recurrente</option>';
  if(selected&&incomes.some(plan=>plan.id===Number(selected)))select.value=String(selected);
}
function syncFunding(){
  const mode=$('#investment-plan-mode').value;
  $('#investment-funding-label').hidden=mode!=='income';$('#investment-funding-amount-label').hidden=mode!=='income';
  $('#investment-form').elements.monthlyContribution.closest('label').hidden=mode!=='monthly';const fundingNote=$('#funding-note');if(fundingNote)fundingNote.hidden=mode!=='income';
}
function setInvestmentPlanFields(investment=null){
  const form=$('#investment-form');
  const sameBank=investment&&!investment.accountId?state.accounts.find(account=>(account.institution||account.name||'').trim().toLocaleLowerCase('es-MX')===String(investment.institution||'').trim().toLocaleLowerCase('es-MX')):null;
  populateAccountChoices($('#investment-account'),investment?investment.accountId??sameBank?.id??'':'');syncInvestmentBank();
  populateFundingChoices(investment?.fundingPlanId||'');
  form.elements.fundingAmount.value=investment?.fundingAmount||0;
  form.elements.monthlyContribution.value=investment?.monthlyContribution||0;
  $('#investment-plan-mode').value=investment&&fundingSource(investment)?'income':Number(investment?.monthlyContribution)>0?'monthly':'none';
  syncFunding();
}
/* Gráfica principal: todo tu dinero del día 1 al último día del mes */
const CHART_DEFAULTS={period:'day',view:'balance',lines:'both',group:'bank',scale:'auto',min:'',max:'',projection:'on',hidden:[]};
const LINE_COLORS=['#3b82c4','#e08a3c','#8a6fd1','#d0574f','#2e9c72','#b8901c','#3fa7bd','#c0559b'];
const axisMoney=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',notation:'compact',maximumFractionDigits:1});
let lastChartRange=null,chartSelectedDay=null;
function chartPrefs(){state.preferences.chart={...CHART_DEFAULTS,...(state.preferences.chart||{})};if(!Array.isArray(state.preferences.chart.hidden))state.preferences.chart.hidden=[];return state.preferences.chart;}
function syncMoneyChartControls(){
  const prefs=chartPrefs();
  $all('#chart-period button').forEach(button=>{const on=button.dataset.period===prefs.period;button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));});$('#chart-view').value=prefs.view;$('#chart-lines').value=prefs.lines;$('#chart-group').value=prefs.group;$('#chart-scale').value=prefs.scale;$('#chart-projection').value=prefs.projection;
  if($('#chart-min')!==document.activeElement)$('#chart-min').value=prefs.min;
  if($('#chart-max')!==document.activeElement)$('#chart-max').value=prefs.max;
  $all('#chart-controls .balance-only').forEach(element=>element.hidden=prefs.view!=='balance');
  $all('#chart-controls .manual-only').forEach(element=>element.hidden=prefs.scale!=='manual');
}
function setupMoneyChartControls(){
  const button=$('#chart-settings-button'),panel=$('#chart-controls');
  button.onclick=()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));button.textContent=panel.hidden?'Ajustar gráfica':'Ocultar ajustes';};
  [['#chart-view','view','change'],['#chart-lines','lines','change'],['#chart-group','group','change'],['#chart-projection','projection','change'],['#chart-scale','scale','change'],['#chart-min','min','input'],['#chart-max','max','input']].forEach(([selector,key,event])=>$(selector).addEventListener(event,()=>{
    const prefs=chartPrefs();prefs[key]=$(selector).value;
    if(key==='scale'&&prefs.scale==='manual'&&prefs.min===''&&prefs.max===''&&lastChartRange){prefs.min=String(Math.floor(lastChartRange.low));prefs.max=String(Math.ceil(lastChartRange.high));}
    if(key==='group'||key==='view')prefs.hidden=[];
    save();syncMoneyChartControls();renderMoneyChart();
  }));
  $all('#chart-period button').forEach(button=>button.onclick=()=>{chartPrefs().period=button.dataset.period;chartSelectedDay=null;save();syncMoneyChartControls();renderMoneyChart();});
  syncMoneyChartControls();
}
function monthInfo(){
  const year=today.getFullYear(),month=today.getMonth(),key=monthKey();
  return{year,month,days:new Date(year,month+1,0).getDate(),todayDay:today.getDate(),dayIso:day=>`${key}-${String(day).padStart(2,'0')}`};
}
/* Puntos de la gráfica principal según el periodo elegido: por día, semana, quincena, mes o año. */
const CHART_PERIOD_TEXT={day:'del día 1 al último día del mes',week:'semana por semana (8 semanas atrás y 3 adelante)',fortnight:'quincena por quincena de este año',month:'mes por mes de este año',year:'año por año'};
function chartInfo(period){
  const base=monthInfo();if(!period||period==='day')return{...base,period:'day',label:n=>String(n),longLabel:n=>new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short'}).format(new Date(base.year,base.month,n)),contains:(n,dateIso)=>dateIso===base.dayIso(n)};
  const d=(y,m,day)=>new Date(y,m,day,12),Y=today.getFullYear(),buckets=[],short=new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short'}),mon=new Intl.DateTimeFormat('es-MX',{month:'short'}),monYear=new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric'});
  if(period==='week'){const monday=new Date(today.getFullYear(),today.getMonth(),today.getDate()-((today.getDay()+6)%7),12);for(let k=-8;k<=3;k++){const start=new Date(monday);start.setDate(start.getDate()+k*7);const end=new Date(start);end.setDate(end.getDate()+6);buckets.push({start,end,label:short.format(start),long:`Semana del ${short.format(start)} al ${short.format(end)}`});}}
  else if(period==='fortnight'){for(let m=0;m<12;m++){const last=new Date(Y,m+1,0).getDate();buckets.push({start:d(Y,m,1),end:d(Y,m,15),label:`1–15 ${mon.format(d(Y,m,1))}`,long:`1 al 15 de ${monYear.format(d(Y,m,1))}`});buckets.push({start:d(Y,m,16),end:d(Y,m,last),label:`16–${last} ${mon.format(d(Y,m,1))}`,long:`16 al ${last} de ${monYear.format(d(Y,m,1))}`});}}
  else if(period==='month'){for(let m=0;m<12;m++)buckets.push({start:d(Y,m,1),end:d(Y,m+1,0),label:mon.format(d(Y,m,1)),long:monYear.format(d(Y,m,1))});}
  else{for(let y=Y-3;y<=Y+1;y++)buckets.push({start:d(y,0,1),end:d(y,11,31),label:String(y),long:`Año ${y}`});}
  const todayIso=iso(today),startIsos=buckets.map(b=>iso(b.start)),endIsos=buckets.map(b=>iso(b.end));
  const todayDay=Math.max(1,endIsos.findIndex((end,index)=>startIsos[index]<=todayIso&&todayIso<=end)+1);
  return{period,year:base.year,month:base.month,days:buckets.length,todayDay,startIso:startIsos[0],dayIso:n=>n===todayDay?todayIso:endIsos[n-1],label:n=>buckets[n-1].label,longLabel:n=>buckets[n-1].long,contains:(n,dateIso)=>startIsos[n-1]<=dateIso&&dateIso<=endIsos[n-1]};
}
function dayValues(info,valueFor){return Array.from({length:info.days},(_,index)=>index+1<=info.todayDay?valueFor(info.dayIso(index+1)):null);}
function movementEffect(movement){const value=Number(movement.amount)||0;return movement.type==='income'?value:-value;}
function accountBalanceOn(account,dateIso,movements){
  // El saldo registrado es el saldo de ese día: no se cuenta como ingreso.
  const anchor=account.balanceDate||iso(today);
  if(account.yield&&dateIso>anchor)return accountYieldBalance(account,dateIso,movements,[]);
  let balance=Number(account.initialBalance)||0;
  for(const movement of movements){
    if(dateIso>=anchor){if(movement.date>anchor&&movement.date<=dateIso)balance+=movementEffect(movement);}
    else if(movement.date>dateIso&&movement.date<=anchor)balance-=movementEffect(movement);
  }
  return balance;
}
/* Cuentas que pagan intereses (por ejemplo, débito con rendimiento): interés sobre el saldo, hasta el tope, menos la retención de ISR. */
function accountYieldBalance(account,dateIso,movements,flows){
  const anchor=account.balanceDate||iso(today),info=account.yield,byDate={};
  movements.forEach(movement=>{if(movement.date>anchor&&movement.date<=dateIso)byDate[movement.date]=(byDate[movement.date]||0)+movementEffect(movement);});
  flows.forEach(flow=>{if(flow.date>anchor&&flow.date<=dateIso)byDate[flow.date]=(byDate[flow.date]||0)+flow.amount;});
  const rate=Number(info.rate||0)/100,cap=Number(info.cap)||0,tax=Number(info.taxRate||0)/100;
  let balance=Number(account.initialBalance)||0,guard=0;
  for(let date=new Date(`${anchor}T12:00:00`);guard++<40000;){
    date.setDate(date.getDate()+1);const key=iso(date);if(key>dateIso)break;
    balance+=byDate[key]||0;
    const lastOfMonth=new Date(date.getFullYear(),date.getMonth()+1,0).getDate()===date.getDate();
    if(info.frequency==='monthly'){if(lastOfMonth){const base=Math.max(0,cap?Math.min(balance,cap):balance),days=date.getDate();balance+=base*rate*days/365;}}
    else balance+=Math.max(0,cap?Math.min(balance,cap):balance)*rate/365;
    balance-=Math.max(0,balance)*tax/365;
  }
  return balance;
}
function investmentValueOn(investment,dateIso){
  if(!investment.startDate||dateIso<investment.startDate)return Number(investment.capital)||0;
  return investmentValue(investment,new Date(`${dateIso}T12:00:00`));
}
function balanceItems(info){
  const items=[],accountIds=new Set(state.accounts.map(account=>account.id)),future=(index)=>index+1>=info.todayDay;
  const projectedValues=valueFor=>Array.from({length:info.days},(_,index)=>future(index)?valueFor(info.dayIso(index+1)):null);
  state.accounts.forEach(account=>{const own=accountMovements(account);items.push({id:`a${account.id}`,bank:(account.institution||account.name||'Cuenta').trim(),label:accountLabel(account.id),values:dayValues(info,day=>accountBalanceOn(account,day,own)),projected:projectedValues(day=>accountProjectedOn(account,day))});});
  state.investments.forEach(investment=>items.push({id:`i${investment.id}`,bank:(investment.institution||'Inversión').trim(),label:investmentName(investment),values:dayValues(info,day=>investmentValueOn(investment,day)),projected:projectedValues(day=>day===iso(today)?investmentValueOn(investment,day):investmentValue(investment,new Date(`${day}T12:00:00`),true))}));
  const loose=state.movements.filter(movement=>!accountIds.has(Number(movement.accountId))&&!movement.investmentId&&movement.type!=='investment'&&movement.type!=='transfer'&&(info.period==='day'?movement.date.startsWith(monthKey()):movement.date>=info.startIso));
  if(loose.length||!items.length){const values=dayValues(info,day=>loose.filter(movement=>movement.date<=day).reduce((sum,movement)=>sum+movementEffect(movement),0)),now=values[info.todayDay-1]??0;items.push({id:'loose',bank:'Sin cuenta',label:'Movimientos sin cuenta (neto del mes)',values,projected:Array.from({length:info.days},(_,index)=>future(index)?now:null)});}
  return items;
}
function groupItems(items,mode){
  if(mode==='item')return items.map(item=>({id:item.id,label:item.label,values:item.values,projected:item.projected}));
  const groups=new Map(),add=(a,b)=>a.map((value,index)=>value===null||b[index]===null?null:value+b[index]);
  items.forEach(item=>{const key=item.id==='loose'?'loose':item.bank.toLocaleLowerCase('es-MX'),group=groups.get(key);if(group){group.values=add(group.values,item.values);group.projected=add(group.projected,item.projected);}else groups.set(key,{id:`g-${key}`,label:item.id==='loose'?item.label:item.bank,values:[...item.values],projected:[...item.projected]});});
  return [...groups.values()];
}
function flowSeries(info){
  if(info.period!=='day'){const rows=Array.from({length:info.days},()=>({income:0,expense:0}));state.movements.filter(movement=>movement.type!=='investment'&&movement.type!=='transfer'&&!(movement.type==='income'&&movement.investmentId)).forEach(movement=>{for(let n=1;n<=info.todayDay;n++)if(info.contains(n,movement.date)){rows[n-1][movement.type]=(rows[n-1][movement.type]||0)+(Number(movement.amount)||0);break;}});const pick=key=>rows.map((row,index)=>index+1>info.todayDay?null:key==='net'?row.income-row.expense:row[key]);return [{key:'income',label:'Ingresos',color:'#278373',width:3,values:pick('income')},{key:'expense',label:'Gastos',color:'#e08a3c',width:3,values:pick('expense')},{key:'net',label:'Neto (ingresos − gastos)',color:'#7669aa',width:3,values:pick('net')}];}
  const rows=Array.from({length:info.days},()=>({income:0,expense:0}));
  state.movements.filter(movement=>movement.date.startsWith(monthKey())&&movement.type!=='investment'&&!(movement.type==='income'&&movement.investmentId)).forEach(movement=>{const day=Number(movement.date.slice(8,10));if(day>=1&&day<=info.days)rows[day-1][movement.type]+=Number(movement.amount)||0;});
  let income=0,expense=0;const values={income:[],expense:[],net:[]};
  rows.forEach((row,index)=>{income+=row.income;expense+=row.expense;const future=index+1>info.todayDay;values.income.push(future?null:income);values.expense.push(future?null:expense);values.net.push(future?null:income-expense);});
  return [{key:'income',label:'Ingresos',color:'#278373',width:3,values:values.income},{key:'expense',label:'Gastos',color:'#e08a3c',width:3,values:values.expense},{key:'net',label:'Neto (ingresos − gastos)',color:'#7669aa',width:3,values:values.net}];
}
function niceScale(min,max){
  if(!Number.isFinite(min)||!Number.isFinite(max)){min=0;max=100;}
  if(min===max){const pad=Math.max(100,Math.abs(max)*.1);min-=pad;max+=pad;}
  const rough=(max-min)/4,power=10**Math.floor(Math.log10(rough)),step=[1,2,2.5,5,10].find(candidate=>candidate*power>=rough)*power;
  return{low:Math.floor(min/step)*step,high:Math.ceil(max/step)*step,step};
}
function drawMonthChart(series,info,prefs,aria){
  const W=960,H=390,left=84,right=20,top=20,bottom=46,plotW=W-left-right,plotH=H-top-bottom;
  const values=series.flatMap(item=>[...item.values,...(item.projected||[])].filter(value=>value!==null&&value!==undefined));
  const dataMin=values.length?Math.min(...values):0,dataMax=values.length?Math.max(...values):0;
  let scale;
  if(prefs.scale==='manual'&&prefs.min!==''&&prefs.max!==''&&Number(prefs.max)>Number(prefs.min)){const low=Number(prefs.min),high=Number(prefs.max);scale={low,high,step:(high-low)/4};}
  else if(prefs.scale==='zero')scale=niceScale(Math.min(0,dataMin),Math.max(0,dataMax));
  else scale=niceScale(dataMin,dataMax);
  lastChartRange=scale;
  const {low,high,step}=scale,x=day=>left+(info.days>1?(day-1)/(info.days-1):0)*plotW,y=value=>top+(high-value)/(high-low)*plotH;
  const ticks=[];for(let value=high,guard=0;value>=low-step/2&&guard<12;value-=step,guard++)ticks.push(value);
  const grid=ticks.map(value=>`<line x1="${left}" y1="${y(value)}" x2="${W-right}" y2="${y(value)}" stroke="#e8ede9"/><text x="${left-9}" y="${y(value)+4}" text-anchor="end" fill="#80928c" font-size="11">${axisMoney.format(Math.abs(value)<1e-9?0:value)}</text>`).join('');
  const zero=low<0&&high>0?`<line x1="${left}" y1="${y(0)}" x2="${W-right}" y2="${y(0)}" stroke="#aab9b2" stroke-width="1.2"/>`:'';
  const xTicks=info.period==='day'?[...new Set([1,5,10,15,20,25,info.days])].filter(day=>day<=info.days&&(day===info.days||info.days-day>=3)):Array.from({length:info.days},(_,index)=>index+1).filter(n=>info.days<=12||n%2===1||n===info.todayDay);
  const xLabels=xTicks.map(day=>`<text x="${x(day)}" y="${H-16}" text-anchor="middle" fill="#80928c" font-size="12">${escapeHtml(info.label(day))}</text>`).join('');
  const future=info.todayDay<info.days?`<rect x="${x(info.todayDay)}" y="${top}" width="${x(info.days)-x(info.todayDay)}" height="${plotH}" fill="#80928c" opacity=".07"/><line x1="${x(info.todayDay)}" y1="${top}" x2="${x(info.todayDay)}" y2="${top+plotH}" stroke="#80928c" stroke-dasharray="4 4"/><text x="${x(info.todayDay)+6}" y="${top+14}" fill="#80928c" font-size="11">Hoy${series.some(item=>item.projected)?' · después: estimado':''}</text>`:'';
  const selected=chartSelectedDay&&chartSelectedDay!==info.todayDay?`<line x1="${x(chartSelectedDay)}" y1="${top}" x2="${x(chartSelectedDay)}" y2="${top+plotH}" stroke="#146c5b" stroke-width="1.5"/>`:'';
  const pathFor=list=>{let path='',started=false;(list||[]).forEach((value,index)=>{if(value===null||value===undefined)return;path+=`${started?'L':'M'} ${x(index+1).toFixed(1)} ${y(value).toFixed(1)} `;started=true;});return path;};
  const valueAt=(item,index)=>index+1>info.todayDay?item.projected?.[index]??null:item.values[index];
  const lines=series.map(item=>{const day=chartSelectedDay||info.todayDay,mark=valueAt(item,day-1);return `<path d="${pathFor(item.values)}" fill="none" stroke="${item.color}" stroke-width="${item.width}" stroke-linecap="round" stroke-linejoin="round"/>${item.projected?`<path d="${pathFor(item.projected)}" fill="none" stroke="${item.color}" stroke-width="${Math.max(2,item.width-1)}" stroke-dasharray="6 6" stroke-linecap="round" opacity=".85"/>`:''}${mark!==null&&mark!==undefined?`<circle cx="${x(day)}" cy="${y(mark)}" r="${item.width+1.5}" fill="${item.color}"/>`:''}`;}).join('');
  const band=info.days>1?plotW/(info.days-1):plotW,lastDay=series.some(item=>item.projected)?info.days:info.todayDay;
  const hits=Array.from({length:lastDay},(_,index)=>{const day=index+1;return `<rect class="chart-day" data-day="${day}" x="${Math.max(left,x(day)-band/2)}" y="${top}" width="${band}" height="${plotH}" fill="transparent"><title>${info.period==='day'?`Día ${day}`:escapeHtml(info.longLabel(day))}${day>info.todayDay?' (estimado)':''}: ${series.map(item=>`${item.label} ${money.format(valueAt(item,index)??0)}`).join(' · ')}</title></rect>`;}).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${aria}"><defs><clipPath id="plot-clip"><rect x="${left}" y="${top-6}" width="${plotW}" height="${plotH+12}"/></clipPath></defs>${grid}${zero}${future}${info.period==='day'?cardChartMarks(info,x,top,plotH):''}${selected}<g clip-path="url(#plot-clip)">${lines}</g>${xLabels}${hits}</svg>`;
}
function renderMoneyChart(){
  const prefs=chartPrefs(),info=chartInfo(prefs.period);let series,subtitle,footnote,aria;const rangeText=CHART_PERIOD_TEXT[info.period];
  if(prefs.view==='flow'){
    series=flowSeries(info);subtitle=info.period==='day'?'Ingresos y gastos acumulados, del día 1 al último día del mes':`Ingresos y gastos de cada periodo, ${rangeText}`;footnote=(info.period==='day'?'Eje horizontal: día del mes':'Eje horizontal: periodo')+' · Eje vertical: pesos. No incluye saldos de cuentas ni inversiones.';aria='Ingresos, gastos y neto acumulados por día durante este mes';
  }else{
    const showProjection=prefs.projection!=='off';
    const groups=groupItems(balanceItems(info),prefs.group).map((item,index)=>({key:item.id,label:item.label,color:LINE_COLORS[index%LINE_COLORS.length],width:2.5,values:item.values,projected:showProjection&&info.todayDay<info.days?item.projected:null}));
    const sum=pick=>Array.from({length:info.days},(_,index)=>{const parts=groups.map(item=>pick(item)?.[index]);return parts.some(value=>value===null||value===undefined)?null:parts.reduce((total,value)=>total+value,0);});
    const total={key:'total',label:'Total',color:'#146c5b',width:4.5,values:sum(item=>item.values),projected:showProjection&&info.todayDay<info.days?sum(item=>item.projected):null};
    series=prefs.lines==='total'?[total]:prefs.lines==='groups'?groups:[...groups,total];
    subtitle=(prefs.lines==='total'?'Total de tu dinero, ':`Saldo de cada ${prefs.group==='bank'?'banco':'cuenta e inversión'}${prefs.lines==='both'?' y el total':''}, `)+rangeText+(info.period==='day'?'':' · saldo al final de cada periodo');
    footnote=(info.period==='day'&&cardFootnote()?cardFootnote()+' ':'')+(state.accounts.length||state.investments.length?`Las cuentas empiezan con el saldo que registraste (no cuenta como ingreso).${showProjection?' La línea punteada después de hoy es una estimación con tus planes recurrentes: la nómina suma en su cuenta y lo que apartas para inversiones o pagos se resta de la cuenta conectada.':''}`:'Agrega tus cuentas en «Cuentas» para ver el saldo de cada banco. Mientras tanto, se muestra el neto de tus movimientos.');
    aria=`Saldo de tu dinero, ${rangeText}`;
  }
  const visible=series.filter(item=>!prefs.hidden.includes(item.key));
  $('#money-chart-title').textContent={day:'Tu dinero este mes',week:'Tu dinero por semana',fortnight:'Tu dinero por quincena',month:'Tu dinero por mes',year:'Tu dinero por año'}[info.period];
  $('#money-chart-subtitle').textContent=subtitle;$('#money-chart-footnote').textContent=footnote;
  $('#money-chart-legend').innerHTML=series.map(item=>{const off=prefs.hidden.includes(item.key);return `<button type="button" class="legend-toggle ${off?'off':''}" data-key="${escapeHtml(item.key)}" aria-pressed="${!off}" title="${off?'Mostrar':'Ocultar'} esta línea"><i style="background:${item.color};height:${item.key==='total'?4:3}px"></i>${escapeHtml(item.label)}</button>`;}).join('');
  $('#line-chart').innerHTML=visible.length?drawMonthChart(visible,info,prefs,aria):'<p class="empty">Todas las líneas están ocultas. Toca un nombre de la leyenda para mostrarla.</p>';
  const maxDay=visible.some(item=>item.projected)?info.days:info.todayDay;if(chartSelectedDay>maxDay)chartSelectedDay=null;
  const day=chartSelectedDay||info.todayDay,estimated=day>info.todayDay,dayName=info.longLabel(day);
  $('#money-chart-readout').innerHTML=`<strong>${day===info.todayDay?(info.period==='day'?`Hoy, ${dayName}`:`${dayName} (hasta hoy)`):dayName}${estimated?' (estimado)':''}:</strong> ${visible.map(item=>`<span><i style="background:${item.color}"></i>${escapeHtml(item.label)} ${money.format((estimated?item.projected?.[day-1]:item.values[day-1])??0)}</span>`).join('')}`;
  $all('#money-chart-legend .legend-toggle').forEach(button=>button.onclick=()=>{const key=button.dataset.key,hidden=new Set(prefs.hidden);hidden.has(key)?hidden.delete(key):hidden.add(key);prefs.hidden=[...hidden];save();renderMoneyChart();});
  $all('#line-chart .chart-day').forEach(rect=>rect.onclick=()=>{chartSelectedDay=Number(rect.dataset.day);renderMoneyChart();});
}
const MX_TAX_RATE=0.9;
function syncTaxPreset(){
  const form=$('#investment-form'),preset=form.elements.taxPreset,rate=form.elements.taxRate,mode=form.elements.taxMode;if(!preset||!rate||!mode)return;
  const value=Number(rate.value)||0;
  preset.value=value===0?'0':mode.value==='capital'&&value===MX_TAX_RATE?'mx':mode.value==='capital'?'custom-capital':'custom-interest';
  rate.hidden=!preset.value.startsWith('custom');
  preset.onchange=()=>{const choice=preset.value;if(choice==='mx'){rate.value=String(MX_TAX_RATE);mode.value='capital';rate.hidden=true;}else if(choice==='0'){rate.value='0';rate.hidden=true;}else{mode.value=choice==='custom-capital'?'capital':'interest';rate.hidden=false;rate.focus();}};
}
/* Explicaciones "?" en lenguaje sencillo. Se definen todas aquí para mantenerlas claras y consistentes. */
function applyFriendlyHelp(){
  $all('.help-bubble,.help-popover').forEach(node=>node.remove());
  const field=(formSelector,name)=>$(formSelector)?.elements[name]?.closest('label');
  const statLabel=index=>$all('.stat-card:not(.total-balance) p')[index];
  const settingsLabel=id=>$(id)?.closest('.settings-row')?.querySelector('span');
  const entries=[
    // Resumen
    [$('.total-balance p'),'Todo tu dinero en cuentas hoy: la suma de tus cuentas de débito y ahorro, menos lo que debes en tus tarjetas de crédito. Las inversiones se muestran aparte.'],
    [statLabel(0),'Tus ingresos del mes menos tus gastos del mes. No incluye el saldo que ya tenías en tus cuentas ni tus inversiones.'],
    [statLabel(1),'Todo el dinero que recibiste este mes: sueldo, ventas, regalos y otros ingresos.'],
    [statLabel(2),'El total de tus gastos de este mes.'],
    [statLabel(3),'Dinero que destinaste a ahorro o inversión este mes. No se cuenta como gasto porque sigue siendo tuyo.'],
    [$('.spending-card .card-title h3'),'Cómo se reparten tus gastos del mes. Cada color es una categoría (comida, renta, transporte…).'],
    [$('#money-chart-title'),'Muestra cuánto dinero tienes cada día del mes. Cada banco tiene su color y la línea gruesa es el total. El saldo que escribes al crear una cuenta es tu punto de partida, no un ingreso. Toca un día para ver sus cifras y toca un nombre para ocultar o mostrar su línea.'],
    [$('#chart-view')?.closest('label'),'Saldo: cuánto dinero tienes en total y en cada banco. Ingresos y gastos: cuánto recibiste y cuánto gastaste en el mes.'],
    [$('#chart-lines')?.closest('label'),'Elige si quieres ver cada banco por separado, solo el total o las dos cosas.'],
    [$('#chart-group')?.closest('label'),'Banco: agrupa en una sola línea todas tus cuentas e inversiones del mismo banco. Cuenta o inversión: una línea para cada una.'],
    [$('#chart-projection')?.closest('label'),'Muestra con línea punteada cuánto tendrías en lo que resta del mes: suma tu nómina y resta los pagos y ahorros que tienes planeados. Es una estimación.'],
    [$('#chart-scale')?.closest('label'),'Automática: se ajusta a tus cifras para que los cambios se aprecien mejor. Empezar en $0: la gráfica parte de cero. Manual: tú defines el mínimo y el máximo.'],
    // Movimientos
    [$('#movimientos .section-heading h2'),'Aquí registras lo que ya ocurrió: ingresos que ya recibiste y gastos que ya pagaste. Lo que esperas a futuro (tu nómina, la renta) se registra en Presupuestos → Plan recurrente.'],
    [field('#movement-form','type'),'Gasto: dinero que pagas. Ingreso: dinero que recibes. Inversión: dinero que destinas a ahorro o inversión (no se cuenta como gasto).'],
    [field('#movement-form','category'),'Agrupa tus gastos e ingresos para que veas en qué usas tu dinero.'],
    [field('#movement-form','accountId'),'La cuenta de la que salió el dinero o en la que se recibió. Así la gráfica del resumen muestra correctamente el saldo de cada banco.'],
    // Cuentas
    [$('.capital-accounts .card-title'),'Tus cuentas de banco o efectivo con dinero disponible (débito, nómina, ahorro). Las inversiones se registran en «Inversiones». No registres el mismo dinero en ambos lugares.'],
    [field('#account-form','kind'),'Débito o ahorro: una cuenta donde tienes tu dinero. Tarjeta de crédito: dinero que el banco te presta; lo que gastes con ella aumenta tu deuda y lo que pagues la reduce.'],
    [field('#account-form','initialBalance'),'Débito: cuánto dinero hay en la cuenta. Crédito: cuánto debes hoy en la tarjeta. Es tu punto de partida: no se cuenta como ingreso ni como gasto.'],
    [field('#account-form','cutDay'),'El día del mes en que el banco cierra tu periodo y calcula cuánto debes pagar. Viene en tu estado de cuenta.'],
    [field('#account-form','dueDay'),'El último día del mes para pagar sin intereses ni recargos. Normalmente es unos 20 días después del corte.'],
    [field('#account-form','alertDays'),'Cuántos días antes quieres el aviso. Lo verás en el Resumen y en Recordatorios y, si activas las notificaciones en Configuración, también como notificación.'],
    [field('#account-form','creditLimit'),'El monto máximo que el banco te permite gastar con la tarjeta. Sirve para mostrarte cuánto crédito tienes disponible.'],
    [$('#budget-sources-card .card-title'),'Elige de dónde sale el dinero que tienes para gastar al mes: tu nómina, el saldo de una cuenta, una inversión o solo sus intereses. El círculo muestra cuánto ocupan tus gastos recurrentes (en gris, como la renta o tus suscripciones), cuánto apartaste con tus límites y cuánto te queda libre. Si un límite tiene el mismo nombre que un gasto recurrente, solo se cuenta el límite.'],
    [$('#account-has-yield')?.closest('label'),'Márcalo si tu banco te paga intereses por tener dinero en esta cuenta (por ejemplo, una cuenta de débito que da 10% anual). La gráfica del resumen sumará esos intereses al saldo.'],
    [field('#account-form','yieldRate'),'El porcentaje al año que te paga la cuenta. Ejemplo: con 10%, por cada $10,000 ganarías unos $1,000 en un año, antes de impuestos.'],
    [field('#account-form','yieldFrequency'),'Con qué frecuencia te depositan los intereses. Si no lo sabes, elige «Cada día»; muchas cuentas digitales pagan diariamente.'],
    [field('#account-form','yieldCap'),'Muchas cuentas solo pagan la tasa alta hasta cierto monto (por ejemplo, hasta $25,000). El excedente no genera intereses. Si no hay límite, deja 0.'],
    [field('#account-form','yieldTax'),'En 2026, en México, los bancos retienen 0.9% al año sobre tu saldo por concepto de ISR. Elige 0% si quieres ver la ganancia sin impuestos.'],
    [field('#account-form','balanceDate'),'El día en que la cuenta tenía ese saldo (normalmente hoy). Lo que registres después de esa fecha se suma o se resta.'],
    // Inversiones
    [$('#investment-form .dialog-head'),'Registra una inversión que ya tienes o que vas a abrir: el monto, la tasa anual y el plazo. Para agregar o retirar dinero después, usa «Aportar o retirar».'],
    [field('#investment-form','capital'),'El monto que tienes hoy en esta inversión o con el que la abres.'],
    [field('#investment-form','rate'),'El porcentaje que el banco o la app te paga al año. Búscalo como «tasa anual» o «GAT nominal». Ejemplo: con 10%, por cada $1,000 ganarías unos $100 en un año, antes de impuestos.'],
    [field('#investment-form','frequency'),'Con qué frecuencia te pagan intereses. Si no lo sabes, deja «Mensual». Muchas apps de ahorro pagan diariamente; en ese caso, elige «Diaria».'],
    [field('#investment-form','startDate'),'Desde qué día empieza a generar intereses.'],
    [field('#investment-form','durationValue'),'Cuánto tiempo planeas mantener el dinero invertido. Si no tiene plazo fijo, deja 12 meses. Después de este plazo la proyección deja de crecer.'],
    [$('#investment-plan-mode-label'),'Elige cómo planeas aportar dinero más adelante: una cantidad fija cada mes o una parte de un ingreso recurrente (por ejemplo, de tu nómina cada quincena). Solo se usa para la proyección; no mueve dinero real.'],
    [field('#investment-form','monthlyContribution'),'El monto que planeas aportar cada mes, el día 1.'],
    [$('#investment-account-label'),'El banco donde está esta inversión. Si ya registraste una cuenta en ese banco, elígela y la inversión queda conectada a ella (aparecerán juntas en la gráfica). Si es en otro lugar, elige «Otra institución» y escribe el nombre.'],
    [$('#movement-investment-label'),'Si eliges una inversión, este monto también se suma a ella (equivale a «Aportar» en Inversiones). Si no, solo queda registrado aquí.'],
    [$('#investment-funding-label'),'El ingreso recurrente del que apartarás dinero (se crea en Presupuestos → Plan recurrente). Cada vez que lo recibas, el monto apartado se suma a esta inversión y se resta de la cuenta conectada en la estimación.'],
    [field('#investment-form','taxPreset'),'El ISR es el impuesto sobre las ganancias de tus ahorros. En 2026, en México, los bancos retienen 0.9% al año sobre el dinero que tienes invertido; por eso es la opción recomendada. Si solo quieres ver la ganancia sin impuestos, elige 0%. Si tu estado de cuenta muestra otra cifra, usa «Personalizado». Esto es una estimación, no asesoría fiscal.'],
    [field('#investment-form','feeChoice'),'Algunas inversiones cobran por administrar tu dinero, como porcentaje de tu saldo o como cantidad fija al año. La mayoría de las cuentas de ahorro y apps no cobran comisión; si no lo sabes, deja 0%. Si la hay, aparece en tu contrato.'],
    [field('#investment-form','interestCap'),'Algunas cuentas solo pagan la tasa alta hasta cierto monto (por ejemplo, hasta $25,000). Escribe ese límite y la app dejará de sumar aportaciones al alcanzarlo. Si no hay límite, deja 0.'],
    [field('#investment-form','interestMode'),'Qué ocurre con los intereses al alcanzar el tope. Reinvertir: los intereses se suman al saldo y también generan intereses. No reinvertir: los intereses ya no generan más intereses.'],
    [field('#investment-form','redirectInvestmentId'),'Cuando esta inversión alcance su tope, las aportaciones planeadas se destinarán a la inversión que elijas aquí. Solo afecta la proyección.'],
    [$('#reflect-initial-label'),'Registra este monto en Movimientos para conservar el historial. No cambia tus ingresos ni tus gastos del mes.'],
    [field('#investment-operation-form','operationType'),'Aportación: agregas dinero a la inversión. Retiro: retiras dinero de ella.'],
    [field('#investment-operation-form','reflectInBalance'),'Además de actualizar la inversión, lo registra en Movimientos y en el saldo de la cuenta que elijas.'],
    [field('#investment-operation-form','accountId'),'La cuenta de la que salió la aportación o en la que se recibió el retiro.'],
    [$('.portfolio-composition .card-title'),'Qué parte de tu dinero está en cada producto. Se actualiza al tocar un punto de la proyección.'],
    [$('#capital .projection-card .card-title'),'Calcula cuánto podrían valer tus inversiones con las tasas que registraste. Arriba puedes elegir el periodo (1 año por defecto). Toca un punto para ver cómo se reparte tu dinero ese día. Es una estimación, no una promesa.'],
    // Presupuestos
    [$('#presupuestos .section-heading h2'),'Límites: el máximo que quieres gastar en una categoría; la app te muestra cuánto llevas. Planes recurrentes: ingresos o pagos que se repiten (nómina, renta). Los planes son previsiones, no movimientos reales.'],
    [$('#budget-form .dialog-head'),'Define cuánto quieres gastar como máximo en una categoría. La app lo compara con tus gastos reales y te avisa al llegar al 80%.'],
    [field('#budget-form','kind'),'Fijo: un gasto que casi no cambia (renta). Variable: un gasto que cambia (comida, salidas).'],
    [field('#budget-form','period'),'Cada cuánto se reinicia el límite: cada semana, cada mes o cada año.'],
    [$('#repay-form .dialog-head'),'Si gastaste más de tu límite, puedes reponer la diferencia poco a poco: cada vez que recibas un ingreso (por ejemplo, tu nómina), apartas una parte. Se guarda como plan; no mueve dinero real.'],
    [field('#repay-form','payments'),'Con más pagos, apartas menos cada vez, pero tardas más en reponerlo.'],
    [$('#recurring-form .dialog-head'),'Para lo que se repite: tu nómina, la renta, el súper. Es solo una previsión; cuando el ingreso o el pago ocurra, regístralo en Movimientos.'],
    [field('#recurring-form','type'),'Ingreso: dinero que recibes (nómina, renta que cobras). Gasto: dinero que pagas (renta, servicios). Pasar dinero: transferencias periódicas a tu cuenta de ahorro, a una inversión o para pagar tu tarjeta de crédito. Las suscripciones (Netflix, Spotify) se registran como Gasto y puedes elegir la tarjeta de crédito como cuenta.'],
    [field('#recurring-form','kind'),'Fijo: siempre es el mismo monto (renta, nómina). Variable: cambia cada vez (súper, gasolina); escribe el monto máximo que esperas.'],
    [field('#recurring-form','frequency'),'Cada cuánto se repite. Quincenal es cada 14 días.'],
    [$('#recurring-account-label'),'La cuenta de banco donde recibes este dinero (por ejemplo, tu nómina) o de la que sale (por ejemplo, la renta). Así la gráfica del resumen estima cuánto tendrá cada banco en lo que resta del mes.'],
    [$('#recurring-investment-label'),'La cuenta de banco o la inversión que recibe el dinero. En la gráfica del resumen se resta de la cuenta de origen y se suma a la de destino.'],
    [$('.recurring-projection .card-title'),'Combina todo lo de esta sección: tus ingresos y gastos recurrentes, tus límites (como si los gastaras por completo) y lo que apartas para ahorro o inversión. «Te queda» es el dinero que sobraría.'],
    // Metas
    [$('#goal-form .dialog-head'),'Define un objetivo (un viaje, un fondo para emergencias) y consulta cuánto te falta.'],
    [field('#goal-form','originAccountId'),'La cuenta de la que sale el dinero cada vez que tocas «Añadir ahorro» (por ejemplo, tu cuenta de nómina). Se resta de ahí y se suma a la cuenta o inversión de la meta. No cuenta como gasto.'],
    [field('#goal-form','current'),'El monto que ya tienes ahorrado para esta meta. Si la vinculas a una cuenta o inversión, escribe aquí solo el dinero que tengas en otro lugar (si no hay, deja 0).'],
    [field('#goal-form','linkType'),'Elige dónde guardas el dinero de esta meta: una cuenta de débito o ahorro, o una inversión. Su saldo cuenta como avance y se actualiza solo. Con «Añadir ahorro», el dinero sale de la cuenta que elijas en «¿De dónde sale el dinero?» y llega a ese lugar. No mueve ni aparta dinero; solo lo muestra. En «Ahorro adicional» escribe solo dinero que no esté en lo vinculado, para no contarlo dos veces.'],
    // Recordatorios
    [$('#recordatorios .section-heading h2'),'Recibirás el aviso al abrir la app en la fecha indicada o después. Para ver avisos, activa las notificaciones en Configuración.'],
    [field('#reminder-form','repeat'),'Elige cada cuánto quieres que se repita. Por ejemplo, un hábito puede ser cada día o cada semana. Si eliges «Solo una vez», el aviso aparece solo en la fecha indicada.'],
    [field('#reminder-form','kind'),'Pago: algo que debes pagar. Hábito: algo que quieres hacer con frecuencia. Revisión: un momento para revisar tus cuentas.'],
    // Configuración
    [settingsLabel('#notification-button'),'Permite que la app te muestre avisos de tus recordatorios.'],
    [$('#reflect-default')?.closest('label'),'Si está marcado, cada vez que aportes o retires de una inversión también se registrará en Movimientos.'],
    [settingsLabel('#export-button'),'Tus datos se guardan solo en este dispositivo. Descarga un respaldo con regularidad; con «Cargar respaldo» puedes recuperarlo aquí o en otro celular.'],
    [settingsLabel('#reset-button'),'Elimina toda la información registrada en este dispositivo. No se puede deshacer, así que descarga un respaldo antes.'],
  ];
  entries.forEach(([element,text])=>{if(element)addHelp(element,text);});
}

/* Plan para reponer cuando te pasas de un límite */
function budgetPeriodKey(budget){
  if(budget.period==='weekly'){const start=new Date(today);start.setDate(today.getDate()-((today.getDay()+6)%7));return iso(start);}
  if(budget.period==='yearly')return String(today.getFullYear());
  return monthKey();
}
function planOccurrenceDates(plan,limit=Number(plan.occurrences)||1){const dates=[];let date=new Date(`${plan.startDate}T12:00:00`);for(let index=0;index<limit;index++){dates.push(new Date(date));date=nextOccurrence(date,plan.frequency);}return dates;}
function nextPlanDate(plan){let date=new Date(`${plan.startDate}T12:00:00`),guard=0;const start=new Date(`${iso(today)}T12:00:00`);while(date<start&&guard++<2000)date=nextOccurrence(date,plan.frequency);return date;}
function activeRepayment(budget){return state.recurringPlans.find(plan=>plan.repayment&&Number(plan.repayment.budgetId)===Number(budget.id)&&plan.repayment.period===budgetPeriodKey(budget));}
function repayMarkup(budget,excess){
  const plan=activeRepayment(budget);
  if(plan){const source=state.recurringPlans.find(item=>item.id===Number(plan.repayment.sourcePlanId)),last=planOccurrenceDates(plan).at(-1);return `<div class="repay-box"><p>Plan para reponer: ${plan.occurrences} pago(s) de ${money.format(plan.amount)}${source?` desde “${escapeHtml(source.title)}”`:''}. Termina el ${displayDate(iso(last))}.</p><button class="small-button danger-button remove-repay" data-id="${plan.id}">Quitar plan</button></div>`;}
  return `<div class="repay-box"><p>Superaste el límite por ${money.format(excess)}. Puedes reponerlo poco a poco con un ingreso que se repite, como tu nómina.</p><button class="small-button open-repay" data-id="${budget.id}">Plan para reponer</button></div>`;
}
function repayExcess(budget){return Math.max(0,budgetSpent(budget)-(Number(budget.limit)||0));}
function openRepay(budgetId){
  const budget=state.budgets.find(item=>item.id===budgetId);if(!budget)return;
  const incomes=state.recurringPlans.filter(plan=>plan.type==='income');
  if(!incomes.length){toast('Primero agrega un ingreso que se repita, como tu nómina.');$('#open-recurring').click();$('#recurring-form').elements.type.value='income';return;}
  const form=$('#repay-form');form.reset();form.elements.budgetId.value=budgetId;
  $('#repay-source').innerHTML=incomes.map(plan=>`<option value="${plan.id}">${escapeHtml(plan.title)} · ${money.format(plan.amount)} ${frequencyLabel(plan.frequency).toLowerCase()}</option>`).join('');
  $('#repay-summary').textContent=`Superaste el límite de ${budget.category} por ${money.format(repayExcess(budget))}. Elige de qué ingreso apartar el dinero y en cuántos pagos.`;
  updateRepayPreview();open('#repay-dialog');
}
function repayDraft(){
  const form=$('#repay-form'),budget=state.budgets.find(item=>item.id===Number(form.elements.budgetId.value)),source=state.recurringPlans.find(plan=>plan.id===Number(form.elements.sourcePlanId.value));
  if(!budget||!source)return null;
  const payments=Number(form.elements.payments.value)||1,excess=repayExcess(budget),amount=Math.ceil(excess/payments*100)/100,first=nextPlanDate(source);
  return{budget,source,payments,excess,amount,plan:{type:'expense',kind:'fixed',accountId:source.accountId??null,title:`Reponer exceso en ${budget.category}`,amount,frequency:source.frequency,startDate:iso(first),occurrences:payments,repayment:{budgetId:budget.id,period:budgetPeriodKey(budget),sourcePlanId:source.id,excess}}};
}
function updateRepayPreview(){
  const draft=repayDraft();if(!draft){$('#repay-preview').textContent='';return;}
  const dates=planOccurrenceDates(draft.plan),first=displayDate(iso(dates[0])),last=displayDate(iso(dates.at(-1)));
  $('#repay-preview').textContent=`Se apartarán ${draft.payments===1?`${money.format(draft.amount)} el ${first}`:`${draft.payments} pagos de ${money.format(draft.amount)}, del ${first} al ${last}`}, cada vez que recibas “${draft.source.title}”. ${draft.amount>Number(draft.source.amount)?'Atención: cada pago es mayor que ese ingreso; elige más pagos.':'Quedará en tus planes recurrentes para que lo tengas presente.'}`;
}
function setupRepay(){
  const form=$('#repay-form');
  form.elements.sourcePlanId.onchange=updateRepayPreview;form.elements.payments.onchange=updateRepayPreview;
  form.addEventListener('submit',event=>{event.preventDefault();const draft=repayDraft();if(!draft)return;if(draft.amount>Number(draft.source.amount)){toast('Cada pago sería mayor que ese ingreso. Elige más pagos.');return;}state.recurringPlans.push({id:id(),...draft.plan});save();$('#repay-dialog').close();renderAll();toast('Plan para reponer creado.');});
}

function setupMovementInvestment(){
  const label=document.createElement('label');label.id='movement-investment-label';
  label.innerHTML='¿A qué inversión?<select name="investmentTarget" id="movement-investment"></select>';
  $('#movement-category').closest('label').insertAdjacentElement('afterend',label);
  $('#movement-type').addEventListener('change',()=>populateMovementInvestment(editingMovementId===null));
}
function populateMovementInvestment(isNew){
  const select=$('#movement-investment');if(!select)return;
  select.innerHTML='<option value="">Ninguna en particular</option>'+state.investments.map(investment=>`<option value="${investment.id}">${escapeHtml(investmentName(investment))}</option>`).join('');
  select.closest('label').hidden=!isNew||$('#movement-type').value!=='investment'||!state.investments.length;
}
function toggleRecurringInvestmentOption(show){const option=$('#recurring-form [name=type] option[value="investment"]');if(option){option.hidden=!show;option.disabled=!show;}}
function setupAccountYield(){const box=$('#account-has-yield');box.onchange=()=>{$('#account-yield-fields').hidden=!box.checked;if(box.checked)$('#account-form').elements.yieldRate.focus();};}
function setAccountYieldFields(info){const form=$('#account-form');form.elements.hasYield.checked=Boolean(info);form.elements.yieldRate.value=info?.rate??0;form.elements.yieldFrequency.value=info?.frequency||'daily';form.elements.yieldCap.value=info?.cap??0;form.elements.yieldTax.value=info&&!Number(info.taxRate)?'0':'mx';$('#account-yield-fields').hidden=!info;}
function deleteMovement(movementId){
  const movement=state.movements.find(item=>item.id===movementId);if(!movement)return;
  const investment=movement.investmentId?state.investments.find(item=>item.id===Number(movement.investmentId)):null,linkedOperation=investment&&typeof movement.investmentOperationId==='number';
  const question=linkedOperation?`¿Eliminar “${movement.title}”? También se quitará esa ${movement.type==='income'?'retirada':'aportación'} de ${investmentName(investment)}.`:`¿Eliminar “${movement.title}” por ${money.format(movement.amount)}? No se puede deshacer.`;
  if(!confirm(question))return;
  state.movements=state.movements.filter(item=>item.id!==movementId);
  if(linkedOperation)investment.operations=(investment.operations||[]).filter(operation=>operation.id!==movement.investmentOperationId);
  save();renderAll();toast('Movimiento eliminado.');
}
/* Tarjetas de crédito */
function syncAccountKind(){
  const form=$('#account-form'),credit=form.elements.kind.value==='credit';
  $('#credit-limit-label').hidden=!credit;$('#credit-note').hidden=!credit;$('#credit-fields').hidden=!credit;
  $('.balance-title').textContent=credit?'Lo que debes hoy (MXN)':'Saldo (MXN)';
  $('#account-has-yield').closest('label').hidden=credit;
  if(credit){form.elements.hasYield.checked=false;$('#account-yield-fields').hidden=true;}
  form.elements.name.placeholder=credit?'Ej. Tarjeta Oro':'Ej. Cuenta principal';
}
/* Presupuesto: dinero disponible al mes y límites */
function monthlyFactor(frequency){return{weekly:52/12,biweekly:26/12,monthly:1,yearly:1/12}[frequency]||1;}
function budgetMonthly(budget){const limit=Number(budget.limit)||0;return budget.period==='weekly'?limit*52/12:budget.period==='yearly'?limit/12:limit;}
function accountMonthlyInterest(account){const info=account.yield;if(!info)return 0;const balance=accountBalanceToday(account),cap=Number(info.cap)||0,base=Math.max(0,cap?Math.min(balance,cap):balance);return base*Number(info.rate||0)/100/12-Math.max(0,balance)*Number(info.taxRate||0)/100/12;}
function budgetSourceOptions(){
  const options=[];
  state.recurringPlans.filter(plan=>plan.type==='income'&&!(Number(plan.occurrences)>0)).forEach(plan=>options.push({key:`plan-${plan.id}`,group:'Ingresos que se repiten (al mes)',label:`${plan.title} · ${money.format(plan.amount)} ${frequencyLabel(plan.frequency).toLowerCase()}`,value:Number(plan.amount)*monthlyFactor(plan.frequency)}));
  state.accounts.filter(account=>account.kind!=='credit').forEach(account=>{options.push({key:`account-${account.id}`,group:'Saldo de tus cuentas hoy',label:accountLabel(account.id),value:Math.max(0,accountBalanceToday(account))});if(account.yield)options.push({key:`accountint-${account.id}`,group:'Solo los intereses (al mes, estimado)',label:accountLabel(account.id),value:Math.max(0,accountMonthlyInterest(account))});});
  state.investments.forEach(investment=>{const value=investmentMetrics(investment).value,next=investmentValue(investment,addMonthsClamped(today,1));options.push({key:`inv-${investment.id}`,group:'Valor de tus inversiones hoy',label:investmentName(investment),value});options.push({key:`invint-${investment.id}`,group:'Solo los intereses (al mes, estimado)',label:investmentName(investment),value:Math.max(0,next-value)});});
  return options;
}
function selectedBudgetSources(options){
  if(Array.isArray(state.preferences.budgetSources)){
    // Los ingresos recurrentes nuevos se suman solos; solo se excluyen los que desmarcaste.
    const known=Array.isArray(state.preferences.budgetSourcesKnown)?new Set(state.preferences.budgetSourcesKnown):new Set(),chosen=new Set(state.preferences.budgetSources);
    options.filter(option=>option.key.startsWith('plan-')&&!known.has(option.key)).forEach(option=>{chosen.add(option.key);const plan=state.recurringPlans.find(item=>`plan-${item.id}`===option.key);if(plan?.accountId)chosen.delete(`account-${plan.accountId}`);});
    return chosen;
  }
  const incomes=options.filter(option=>option.key.startsWith('plan-'));
  return new Set((incomes.length?incomes:options.filter(option=>option.key.startsWith('account-'))).map(option=>option.key));
}
/* Fechas de un plan dentro del mes actual (para saber si ya se pagó o está por pagarse) */
function planDatesThisMonth(plan){
  const first=new Date(today.getFullYear(),today.getMonth(),1,12),last=new Date(today.getFullYear(),today.getMonth()+1,0,12),max=Number(plan.occurrences)>0?Number(plan.occurrences):Infinity,dates=[];
  let date=new Date(`${plan.startDate}T12:00:00`),index=0,guard=0;
  while(date<=last&&index<max&&guard++<5000){if(date>=first)dates.push(iso(date));date=nextOccurrence(date,plan.frequency);index++;}
  return dates;
}
function planIsActive(plan){
  if(!(Number(plan.occurrences)>0))return true;
  return planDatesThisMonth(plan).length>0||countPlanTo(plan,addMonthsClamped(today,12))>0;
}
/* Gastos recurrentes que ocupan parte del dinero del mes. Si un límite tiene el mismo nombre, el límite ya los incluye. */
function recurringExpenseSlices(){
  return state.recurringPlans.filter(plan=>plan.type==='expense'&&planIsActive(plan)&&!overlapBudget(plan.title)).map(plan=>{
    const dates=planDatesThisMonth(plan),todayIso=iso(today),paid=dates.filter(date=>date<=todayIso),pending=dates.filter(date=>date>todayIso);
    const status=!dates.length?'no toca este mes':pending.length?`próximo pago: ${displayDate(pending[0])}${paid.length?` · ya pasó ${paid.length===1?'un pago':`${paid.length} pagos`}`:''}`:`ya se pagó este mes (${displayDate(paid[paid.length-1])})`;
    return {label:plan.title,value:Number(plan.amount)*monthlyFactor(plan.frequency),status,recurring:true};
  });
}
function renderBudgetPie(){
  const options=budgetSourceOptions(),selected=selectedBudgetSources(options),available=options.filter(option=>selected.has(option.key)).reduce((sum,option)=>sum+option.value,0);
  const RECURRING_COLORS=['#8a9a94','#a3b1ab','#6f817a','#b8c4bf'];
  const recurring=recurringExpenseSlices().map((item,index)=>({...item,color:RECURRING_COLORS[index%RECURRING_COLORS.length]}));
  const limits=state.budgets.map((budget,index)=>({label:budget.category,value:budgetMonthly(budget),spent:budgetSpent(budget),period:budget.period||'monthly',color:COLORS[index%COLORS.length],covers:overlapPlans(budget.category)}));
  const fixed=recurring.reduce((sum,item)=>sum+item.value,0),limited=limits.reduce((sum,item)=>sum+item.value,0),assigned=fixed+limited,free=Math.max(0,available-assigned),base=Math.max(available,assigned);
  let running=0;const parts=[...recurring.filter(item=>item.value>0),...limits.filter(item=>item.value>0),...(free>0?[{label:'Libre',value:free,color:'#dbe4df'}]:[])];
  const slices=parts.map(item=>{const start=running;running+=item.value/base*100;return `${item.color} ${start}% ${running}%`;});
  $('#budget-pie').style.background=base>0?`conic-gradient(${slices.join(',')})`:'#e9eeea';
  $('#budget-pie-total').textContent=money.format(available);
  $('#budget-pie').setAttribute('aria-label',`Disponible ${money.format(available)} al mes; gastos recurrentes ${money.format(fixed)}; límites ${money.format(limited)}.`);
  const note=$('#budget-pie-note');note.classList.toggle('warn',assigned>available&&available>0);
  const doubled=options.filter(option=>selected.has(option.key)&&option.key.startsWith('plan-')).some(option=>{const plan=state.recurringPlans.find(item=>`plan-${item.id}`===option.key);return plan?.accountId&&selected.has(`account-${plan.accountId}`);});
  $('#budget-sources-warning').hidden=!doubled;
  const what=fixed&&limited?'tus gastos recurrentes y tus límites':fixed?'tus gastos recurrentes':'tus límites';
  const sourceNames=options.filter(option=>selected.has(option.key)).map(option=>option.key.startsWith('plan-')?state.recurringPlans.find(plan=>`plan-${plan.id}`===option.key)?.title||option.label:option.label);
  note.textContent=!available?'Elige abajo de dónde sale tu dinero.':assigned>available?`Entre ${what} suman ${money.format(assigned)} al mes: ${money.format(assigned-available)} más de lo que tienes disponible.`:assigned?`Te quedan ${money.format(free)} libres al mes después de ${what}.`:`Tienes ${money.format(available)} libres al mes.`;
  if(available)note.textContent=`Disponible al mes: ${sourceNames.join(' + ')} = ${money.format(available)}. `+note.textContent;
  const periodName={weekly:'esta semana',monthly:'este mes',yearly:'este año'};
  const recurringLegend=recurring.map(item=>`<span class="legend-item"><i class="legend-dot" style="background:${item.color}"></i><strong>${escapeHtml(item.label)}</strong> · gasto recurrente · ${money.format(item.value)} al mes · ${item.status}</span>`).join('');
  const limitLegend=limits.map(item=>`<span class="legend-item"><i class="legend-dot" style="background:${item.color}"></i><strong>${escapeHtml(item.label)}</strong> · límite · ${money.format(item.value)} al mes · gastado ${periodName[item.period]||'este mes'}: ${money.format(item.spent)}${item.covers.length?` · ya incluye tu gasto recurrente «${escapeHtml(item.covers[0].title)}»`:''}</span>`).join('');
  $('#budget-pie-legend').innerHTML=(recurring.length||limits.length?recurringLegend+limitLegend:'<span class="legend-item">Aún no tienes gastos recurrentes ni límites. Crea uno con «＋ Plan recurrente» o «＋ Límite por categoría».</span>')+(free>0?`<span class="legend-item"><i class="legend-dot" style="background:#dbe4df;border:1px solid #b9c7c0"></i><strong>Libre</strong> · ${money.format(free)}</span>`:'');
  const groups=[...new Set(options.map(option=>option.group))];
  $('#budget-sources-list').innerHTML=options.length?groups.map(group=>`<h4>${escapeHtml(group.toUpperCase())}</h4>${options.filter(option=>option.group===group).map(option=>`<label class="check-label"><input type="checkbox" data-source="${option.key}" ${selected.has(option.key)?'checked':''} /> ${escapeHtml(option.label)} · ${money.format(option.value)}</label>`).join('')}`).join(''):'<p class="empty">Agrega un ingreso recurrente (como tu nómina), una cuenta o una inversión para calcular tu dinero disponible.</p>';
  $all('#budget-sources-list input[data-source]').forEach(input=>input.onchange=()=>{state.preferences.budgetSources=$all('#budget-sources-list input[data-source]:checked').map(box=>box.dataset.source);state.preferences.budgetSourcesKnown=options.map(option=>option.key);save();renderBudgetPie();});
}
/* Proyección de Presupuestos: usa todo lo de la pestaña; los límites cuentan como gasto completo */
function renderBudgetProjection(){
  renderBudgetPie();
  const savingsPlans=[...state.recurringPlans.filter(plan=>plan.type==='investment'),...fundingPlans()],monthlyLimits=state.budgets.reduce((sum,budget)=>sum+budgetMonthly(budget),0),monthlyContributions=state.investments.reduce((sum,investment)=>sum+(Number(investment.monthlyContribution)||0),0);
  const hasData=state.recurringPlans.length||state.budgets.length||savingsPlans.length||monthlyContributions;
  if(!hasData){$('#recurring-projection').innerHTML='<p class="empty">Agrega ingresos o gastos recurrentes, o límites por categoría, para ver tu proyección.</p>';$('#recurring-chart').innerHTML='';return;}
  const rows=Array.from({length:13},(_,months)=>{const target=addMonthsClamped(today,months),sum=list=>months===0?0:list.reduce((total,plan)=>total+countPlanTo(plan,target)*Number(plan.amount),0);const income=sum(state.recurringPlans.filter(plan=>plan.type==='income')),planned=sum(state.recurringPlans.filter(plan=>plan.type==='expense')),limits=monthlyLimits*months,savings=sum(savingsPlans)+monthlyContributions*months;return{months,income,planned,limits,savings,left:income-planned-limits-savings};});
  $('#recurring-projection').innerHTML=`${projectionOverlapNote()}<div class="projection-table-wrap"><table class="projection-table"><thead><tr><th>Próximos</th><th>Ingresos</th><th>Gastos planeados</th><th>Límites (gasto esperado)</th><th>Ahorro e inversión</th><th>Te queda</th></tr></thead><tbody>${rows.filter(row=>[1,3,6,12].includes(row.months)).map(row=>`<tr><th>${row.months===1?'1 mes':`${row.months} meses`}</th><td>${money.format(row.income)}</td><td>${money.format(row.planned)}</td><td>${money.format(row.limits)}</td><td>${money.format(row.savings)}</td><td class="${row.left<0?'negative':'positive'}"><strong>${money.format(row.left)}</strong></td></tr>`).join('')}</tbody></table></div>`;
  const series=[{key:'income',label:'Ingresos',color:'#278373',width:3,value:row=>row.income},{key:'spend',label:'Gastos planeados + límites',color:'#e08a3c',width:3,value:row=>row.planned+row.limits},{key:'savings',label:'Ahorro e inversión',color:'#3b82c4',width:3,value:row=>row.savings},{key:'left',label:'Te queda',color:'#146c5b',width:4.5,value:row=>row.left}];
  const W=900,H=300,L=88,R=22,T=24,B=42,plotW=W-L-R,plotH=H-T-B,all=rows.flatMap(row=>series.map(item=>item.value(row))),{low,high,step}=niceScale(Math.min(0,...all),Math.max(0,...all));
  const x=index=>L+index/(rows.length-1)*plotW,y=value=>T+(high-value)/(high-low)*plotH;
  const grid=[];for(let value=high,guard=0;value>=low-step/2&&guard<12;value-=step,guard++)grid.push(`<line x1="${L}" y1="${y(value)}" x2="${W-R}" y2="${y(value)}" stroke="#dfe8e2"/><text x="${L-8}" y="${y(value)+4}" text-anchor="end" fill="#80928c" font-size="11">${axisMoney.format(Math.abs(value)<1e-9?0:value)}</text>`);
  const zero=low<0?`<line x1="${L}" y1="${y(0)}" x2="${W-R}" y2="${y(0)}" stroke="#aab9b2" stroke-width="1.2"/>`:'';
  const paths=series.map(item=>`<path d="${rows.map((row,index)=>`${index?'L':'M'} ${x(index)} ${y(item.value(row))}`).join(' ')}" fill="none" stroke="${item.color}" stroke-width="${item.width}" stroke-linejoin="round"/>${rows.map((row,index)=>`<circle cx="${x(index)}" cy="${y(item.value(row))}" r="3" fill="${item.color}"><title>${index?`${index} m`:'Hoy'} · ${item.label}: ${money.format(item.value(row))}</title></circle>`).join('')}`).join('');
  const labels=rows.map((row,index)=>`<text x="${x(index)}" y="${H-12}" text-anchor="middle" fill="#80928c" font-size="11">${index?`${index} m`:'Hoy'}</text>`).join('');
  $('#recurring-chart').innerHTML=`<div class="investment-forecast"><div class="line-legend">${series.map(item=>`<span><i style="background:${item.color}"></i>${item.label}</span>`).join('')}</div><p>Eje horizontal: meses desde hoy · eje vertical: pesos acumulados. Los límites se cuentan como si los gastaras completos.</p><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Proyección de ingresos, gastos, ahorro y lo que te queda">${grid.join('')}${zero}${paths}${labels}</svg></div>`;
}

/* Avisos dentro de la app para detalles que pueden confundir */
function normalizeText(text){return String(text||'').toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}
function overlapPlans(category){const key=normalizeText(category);return key?state.recurringPlans.filter(plan=>plan.type==='expense'&&!plan.repayment&&normalizeText(plan.title).includes(key)):[];}
function overlapBudget(title){const text=normalizeText(title);return text?state.budgets.find(budget=>normalizeText(budget.category)&&text.includes(normalizeText(budget.category))):null;}
function budgetOverlapNote(budget){const plans=overlapPlans(budget.category);return plans.length?`<p class="form-warning">Atención: también tienes «${escapeHtml(plans[0].title)}» como gasto recurrente. En la proyección se contaría dos veces. Conserva solo uno de los dos.</p>`:'';}
function planOverlapNote(plan){if(plan.type!=='expense'||plan.repayment)return '';const budget=overlapBudget(plan.title);return budget?`<p class="form-warning">Atención: también tienes un límite de «${escapeHtml(budget.category)}». En la proyección se contaría dos veces. Conserva solo uno de los dos.</p>`:'';}
function projectionOverlapNote(){const count=state.budgets.filter(budget=>overlapPlans(budget.category).length).length;return count?`<p class="form-warning">Atención: ${count===1?'un límite se parece':`${count} límites se parecen`} a un gasto recurrente, así que ese gasto se está contando dos veces aquí. Revisa los avisos en Límites.</p>`:'';}
function setupOverlapWarnings(){
  const budgetForm=$('#budget-form'),recurringForm=$('#recurring-form');
  budgetForm.querySelector('.submit-button').insertAdjacentHTML('beforebegin','<p class="form-warning" id="budget-form-warning" hidden></p>');
  recurringForm.querySelector('.submit-button').insertAdjacentHTML('beforebegin','<p class="form-warning" id="recurring-form-warning" hidden></p>');
  const checkBudget=()=>{const plans=overlapPlans(budgetForm.elements.category.value),box=$('#budget-form-warning');box.hidden=!plans.length;if(plans.length)box.textContent=`Ya tienes «${plans[0].title}» como gasto recurrente. Si también creas este límite, en la proyección se contará dos veces.`;};
  const checkPlan=()=>{const budget=recurringForm.elements.type.value==='expense'?overlapBudget(recurringForm.elements.title.value):null,box=$('#recurring-form-warning');box.hidden=!budget;if(budget)box.textContent=`Ya tienes un límite de «${budget.category}». Si también lo registras como gasto recurrente, en la proyección se contará dos veces.`;};
  budgetForm.elements.category.addEventListener('change',checkBudget);recurringForm.elements.title.addEventListener('input',checkPlan);recurringForm.elements.type.addEventListener('change',checkPlan);
  ['#budget-dialog','#recurring-dialog'].forEach(id=>new MutationObserver(()=>{if($(id).open){checkBudget();checkPlan();}}).observe($(id),{attributes:true,attributeFilter:['open']}));
  $('#credit-limit-label').insertAdjacentHTML('afterend','<p class="form-note" id="credit-note" hidden>Para pagar tu tarjeta, crea en Presupuestos un plan «Pasar dinero» de tu cuenta de débito a esta tarjeta, o registra el pago como movimiento. Lo que gastes con ella aumenta tu deuda.</p>');
  $('#investment-funding-amount-label').insertAdjacentHTML('afterend','<p class="form-note" id="funding-note" hidden>En la estimación, el monto apartado se restará del banco donde recibes ese ingreso, aunque la inversión esté en otro banco.</p>');
  $('#budget-sources-list').insertAdjacentHTML('beforebegin','<p class="form-warning" id="budget-sources-warning" hidden>Atención: marcaste un ingreso y también el saldo de la cuenta donde se deposita. Ese dinero podría contarse dos veces.</p>');
  $('#account-form').elements.balanceDate.closest('.two-cols').insertAdjacentHTML('afterend','<p class="form-note">Si no conoces la fecha exacta del saldo, deja la de hoy. Lo que registres después de esa fecha se suma o se resta.</p>');
}
/* Aviso para descargar el respaldo: los datos solo viven en este dispositivo */
function renderBackupReminder(){
  let box=$('#backup-reminder');
  if(!box){$('#inicio .stat-grid').insertAdjacentHTML('afterend','<div class="backup-reminder" id="backup-reminder" role="status" hidden><span id="backup-reminder-text"></span><span class="button-pair"><button type="button" class="small-button primary-small" id="backup-reminder-download">Descargar respaldo</button><button type="button" class="small-button" id="backup-reminder-later">Después</button></span></div>');box=$('#backup-reminder');$('#backup-reminder-download').onclick=()=>$('#export-button').click();$('#backup-reminder-later').onclick=()=>{state.preferences.backupSnooze=iso(new Date());save();box.hidden=true;};}
  const count=state.movements.length+state.accounts.length+state.investments.length+state.recurringPlans.length+state.budgets.length+state.goals.length;
  const days=value=>value?Math.floor((new Date(`${iso(new Date())}T12:00:00`)-new Date(`${value}T12:00:00`))/86400000):Infinity;
  const last=days(state.preferences.lastBackup),snoozed=days(state.preferences.backupSnooze)<3;
  box.hidden=!count||last<14||snoozed;
  $('#backup-reminder-text').textContent=last===Infinity?'Tus datos solo se guardan en este dispositivo. Si borras los datos del navegador o cambias de celular, se perderán. Descarga un respaldo para conservarlos.':`Tu último respaldo fue hace ${last} días. Descarga uno nuevo para conservar tus registros más recientes.`;
}
/* Solo una ayuda abierta a la vez; se cierra al tocar fuera o con Esc */
function closeHelpPopovers(){$all('.help-popover:not([hidden])').forEach(node=>node.hidden=true);$all('.help-bubble[aria-expanded="true"]').forEach(node=>node.setAttribute('aria-expanded','false'));}
document.addEventListener('click',event=>{if(!event.target.closest('.help-popover,.help-bubble'))closeHelpPopovers();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeHelpPopovers();});
/* Tutorial breve: aparece la primera vez y se puede volver a ver desde Configuración */
const TUTORIAL_STEPS=[
  {icon:'👋',title:'Bienvenido a Claro',text:'Claro te ayuda a ver cuánto dinero tienes, en qué lo usas y cuánto tendrás en los próximos meses. Tus datos se guardan solo en este dispositivo y nadie más tiene acceso a ellos.'},
  {icon:'🏦',title:'1. Agrega tus cuentas',text:'En «Cuentas», toca «＋ Agregar cuenta» y escribe cuánto tienes hoy en cada banco. Puedes elegir si es de débito o tarjeta de crédito, y si te paga intereses.',page:'capital',action:'Ir a mis cuentas'},
  {icon:'🧾',title:'2. Registra tus gastos e ingresos',text:'Toca «＋ Movimiento real» cada vez que hagas un pago o recibas dinero. Elige la cuenta para que su saldo se actualice automáticamente.',page:'movimientos',action:'Ir a Movimientos'},
  {icon:'🔁',title:'3. Planea lo que se repite',text:'En «Presupuestos» agrega tu nómina, la renta o tus suscripciones como planes recurrentes, y define límites por categoría. Claro te muestra cuánto te queda libre al mes.',page:'presupuestos',action:'Ir a Presupuestos'},
  {icon:'📈',title:'4. Haz crecer tu dinero',text:'En «Inversiones» registra tus inversiones con su tasa y plazo. Verás una proyección de cuánto tendrás. En «Metas» puedes ahorrar para un objetivo específico.',page:'capital',action:'Ir a Inversiones'},
  {icon:'💡',title:'5. Revisa y respalda',text:'En «Resumen» ves la gráfica de tu dinero del mes. Si tienes dudas, toca cualquier «?». Además, descarga un respaldo con regularidad desde Configuración para no perder tus datos.',page:'inicio',action:'Ir al Resumen'}
];
let tutorialStep=0;
function setupTutorial(){
  document.body.insertAdjacentHTML('beforeend','<dialog id="tutorial-dialog" class="tutorial-dialog" aria-labelledby="tutorial-title"><div class="dialog-head"><span class="eyebrow" id="tutorial-count"></span><button type="button" class="close-dialog" id="tutorial-close" aria-label="Cerrar tutorial">×</button></div><div class="tutorial-icon" id="tutorial-icon" aria-hidden="true"></div><h2 id="tutorial-title"></h2><p id="tutorial-text"></p><button type="button" class="text-link tutorial-go" id="tutorial-go"></button><div class="tutorial-dots" id="tutorial-dots"></div><div class="tutorial-actions"><button type="button" class="small-button" id="tutorial-back">Atrás</button><button type="button" class="primary-button" id="tutorial-next">Siguiente</button></div></dialog>');
  const finish=()=>{state.preferences.tutorialSeen=true;save();$('#tutorial-dialog').close();};
  $('#tutorial-close').onclick=finish;
  $('#tutorial-dialog').addEventListener('cancel',()=>{state.preferences.tutorialSeen=true;save();});
  $('#tutorial-back').onclick=()=>{tutorialStep=Math.max(0,tutorialStep-1);renderTutorial();};
  $('#tutorial-next').onclick=()=>{if(tutorialStep>=TUTORIAL_STEPS.length-1)finish();else{tutorialStep++;renderTutorial();}};
  $('#tutorial-go').onclick=()=>{const step=TUTORIAL_STEPS[tutorialStep];finish();goToPage(step.page,true);};
  const row=$('#export-button').closest('.settings-row');
  row.insertAdjacentHTML('beforebegin','<div class="settings-row"><span>¿Cómo se usa Claro?</span><button type="button" class="small-button" id="open-tutorial">Ver tutorial</button></div>');
  $('#open-tutorial').onclick=()=>openTutorial();
  if(!state.preferences.tutorialSeen)setTimeout(()=>{if(!document.querySelector('dialog[open]'))openTutorial();},400);
}
function openTutorial(){tutorialStep=0;renderTutorial();$('#tutorial-dialog').showModal();}
function renderTutorial(){
  const step=TUTORIAL_STEPS[tutorialStep],last=tutorialStep===TUTORIAL_STEPS.length-1;
  $('#tutorial-count').textContent=`PASO ${tutorialStep+1} DE ${TUTORIAL_STEPS.length}`;
  $('#tutorial-icon').textContent=step.icon;$('#tutorial-title').textContent=step.title;$('#tutorial-text').textContent=step.text;
  $('#tutorial-go').hidden=!step.page;$('#tutorial-go').textContent=step.action?`${step.action} →`:'';
  $('#tutorial-dots').innerHTML=TUTORIAL_STEPS.map((_,index)=>`<i class="${index===tutorialStep?'active':''}"></i>`).join('');
  $('#tutorial-back').hidden=tutorialStep===0;$('#tutorial-next').textContent=last?'Empezar':'Siguiente';
}
/* Recordatorios que se repiten (por ejemplo, un hábito diario) */
const REMINDER_REPEAT_LABEL={daily:'Cada día',weekly:'Cada semana',biweekly:'Cada quincena',monthly:'Cada mes',yearly:'Cada año'};
function reminderRepeats(reminder){return Boolean(REMINDER_REPEAT_LABEL[reminder.repeat]);}
function reminderNextDate(reminder){
  const todayIso=iso(today);if(!reminderRepeats(reminder)||reminder.date>=todayIso)return reminder.date;
  let date=new Date(`${reminder.date}T12:00:00`),guard=0;
  while(iso(date)<todayIso&&guard++<20000){if(reminder.repeat==='daily')date.setDate(date.getDate()+1);else date=nextOccurrence(date,reminder.repeat);}
  return iso(date);
}
function setupReminderRepeat(){
  const form=$('#reminder-form');
  form.elements.kind.addEventListener('change',()=>{if(form.elements.kind.value==='habit'&&form.elements.repeat.value==='none')form.elements.repeat.value='daily';});
}
/* Metas: el ahorro puede salir de una cuenta y guardarse en una cuenta de débito o en una inversión */
function populateGoalOriginChoices(selected){
  const select=$('#goal-origin');if(!select)return;const current=selected??select.value;
  select.innerHTML='<option value="">No restarlo de ninguna cuenta</option>'+state.accounts.filter(account=>account.kind!=='credit').map(account=>`<option value="${account.id}">${escapeHtml(accountLabel(account.id))} · ${money.format(accountBalanceToday(account))}</option>`).join('');
  select.value=String(current||'');if(select.value!==String(current||''))select.value='';
}
function addToGoal(goalId){
  const goal=state.goals.find(item=>item.id===goalId);if(!goal)return;
  const origin=state.accounts.find(item=>item.id===Number(goal.originAccountId)),destAccount=goal.linkType==='account'?state.accounts.find(item=>item.id===Number(goal.accountId)):null,destInvestment=goal.linkType==='investment'?state.investments.find(item=>item.id===Number(goal.investmentId)):null;
  const route=destAccount||destInvestment?` Se ${origin?`pasará de ${accountLabel(origin.id)} a`:'sumará a'} ${destAccount?accountLabel(destAccount.id):investmentName(destInvestment)}.`:'';
  const value=Number(String(prompt(`¿Cuánto quieres ahorrar para «${goal.name}»? (MXN)${route}`)||'').replace(/[$,\s]/g,''));
  if(!(value>0))return;
  const base={id:id(),title:`Ahorro: ${goal.name}`,amount:value,date:iso(today),category:'Otros',note:'',goalId:goal.id};
  if(destAccount){state.movements.push({...base,type:'transfer',accountId:origin?origin.id:null,toAccountId:destAccount.id});}
  else if(destInvestment){
    const cap=Number(destInvestment.interestCap)||0;if(cap&&investmentPrincipal(destInvestment)+value>cap){toast(`El tope de esa inversión es ${money.format(cap)}. Puedes aportar hasta ${money.format(Math.max(0,cap-investmentPrincipal(destInvestment)))}.`);return;}
    const operation={id:id(),type:'contribution',amount:value,date:iso(today),note:`Ahorro para ${goal.name}`,reflectInBalance:true};
    destInvestment.operations=destInvestment.operations||[];destInvestment.operations.push(operation);
    state.movements.push({...base,type:'investment',accountId:origin?origin.id:null,investmentId:destInvestment.id,investmentOperationId:operation.id});
  }
  else goal.current=Number(goal.current||0)+value;
  save();renderAll();
  toast(destAccount||destInvestment?`Listo: ${money.format(value)} ${origin?`salieron de ${accountLabel(origin.id)} y `:''}se guardaron en ${destAccount?accountLabel(destAccount.id):investmentName(destInvestment)}.`:'Avance actualizado.');
}
/* Tarjetas de crédito: fecha de corte, fecha límite de pago y avisos */
function nextMonthDay(day){
  const base=new Date(today.getFullYear(),today.getMonth(),1,12),make=offset=>{const year=base.getFullYear(),month=base.getMonth()+offset,last=new Date(year,month+1,0).getDate();return new Date(year,month,Math.min(day,last),12);};
  const start=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12);let date=make(0);if(date<start)date=make(1);return date;
}
function cardEvents(){
  const start=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12),events=[];
  state.accounts.filter(account=>account.kind==='credit').forEach(account=>{
    [['cut','Fecha de corte',account.cutDay,account.alerts?.cut],['due','Fecha límite de pago',account.dueDay,account.alerts?.due]].forEach(([type,label,day,alert])=>{
      if(!day)return;const date=nextMonthDay(Number(day));events.push({key:`card-${account.id}-${type}`,type,label,account,date:iso(date),daysLeft:Math.round((date-start)/86400000),alert:Boolean(alert),alertDays:Number(account.alerts?.days)||0});
    });
  });
  return events.sort((a,b)=>a.date.localeCompare(b.date));
}
function cardMonthDates(account,day){
  if(!day)return null;const info=monthInfo();return Math.min(Number(day),info.days);
}
function cardChartMarks(info,x,top,plotH){
  const marks=[];state.accounts.filter(account=>account.kind==='credit').forEach(account=>{[['cut','Corte',account.cutDay,'#b08a2e'],['due','Pago',account.dueDay,'#c94d45']].forEach(([type,word,day,color])=>{const d=cardMonthDates(account,day);if(d)marks.push({d,text:`${word} ${account.name}`,color,title:`${type==='cut'?'Fecha de corte':'Fecha límite de pago'} · ${accountLabel(account.id)} · día ${d}`});});});
  return marks.sort((a,b)=>a.d-b.d).map((mark,index)=>`<g class="card-mark"><line x1="${x(mark.d)}" y1="${top}" x2="${x(mark.d)}" y2="${top+plotH}" stroke="${mark.color}" stroke-width="1.4" stroke-dasharray="2 3" opacity=".9"/><text x="${x(mark.d)+4}" y="${top+30+(index%3)*13}" fill="${mark.color}" font-size="13" font-weight="700">${escapeHtml(mark.text)}</text><title>${escapeHtml(mark.title)}</title></g>`).join('');
}
function cardWhen(event){return event.daysLeft===0?'hoy':event.daysLeft===1?'mañana':`en ${event.daysLeft} días`;}
function cardReminderMarkup(){
  return cardEvents().map(event=>`<article class="reminder-item card-reminder"><span class="category-icon">${event.type==='due'?'$':'✂'}</span><h3 style="margin-top:13px">${event.label} · ${escapeHtml(accountLabel(event.account.id))}</h3><p class="reminder-date">${displayDate(event.date)} (${cardWhen(event)}) · Tarjeta de crédito · ${event.alert?(event.alertDays?`aviso ${event.alertDays} ${event.alertDays===1?'día':'días'} antes`:'aviso el mismo día'):'sin aviso'}</p>${event.type==='due'?`<p class="goal-link-note">Saldo hoy: ${money.format(accountBalanceToday(event.account))}</p>`:''}<div class="goal-actions"><button type="button" class="small-button config-card" data-id="${event.account.id}">Configurar tarjeta</button></div></article>`).join('');
}
function renderCardAlerts(){
  let box=$('#card-alerts');if(!box){$('#inicio .stat-grid').insertAdjacentHTML('afterend','<div class="backup-reminder card-alerts" id="card-alerts" role="status" hidden></div>');box=$('#card-alerts');}
  const due=cardEvents().filter(event=>event.alert&&event.daysLeft<=event.alertDays);
  box.hidden=!due.length;
  box.innerHTML=due.map(event=>`<span>💳 <strong>${escapeHtml(accountLabel(event.account.id))}</strong>: ${event.label.toLowerCase()} ${cardWhen(event)} (${displayDate(event.date)})${event.type==='due'?` · saldo ${money.format(accountBalanceToday(event.account))}`:''}.</span>`).join('<br />');
}
function cardFootnote(){const parts=[];state.accounts.filter(account=>account.kind==='credit').forEach(account=>{const items=[account.cutDay?`corte el día ${cardMonthDates(account,account.cutDay)}`:'',account.dueDay?`pago límite el día ${cardMonthDates(account,account.dueDay)}`:''].filter(Boolean);if(items.length)parts.push(`${accountLabel(account.id)}: ${items.join(' y ')}`);});return parts.length?`Líneas punteadas de color: fechas de tus tarjetas (${parts.join('; ')}).`:'';}
/* Saldo total de hoy: lo primero que se ve en el Resumen */
function renderTotalBalance(){
  const debit=state.accounts.filter(account=>account.kind!=='credit'),credit=state.accounts.filter(account=>account.kind==='credit');
  const have=debit.reduce((sum,account)=>sum+accountBalanceToday(account),0),owe=credit.reduce((sum,account)=>sum+Math.max(0,-accountBalanceToday(account)),0),creditPlus=credit.reduce((sum,account)=>sum+Math.max(0,accountBalanceToday(account)),0);
  const total=have+creditPlus-owe,invested=state.investments.reduce((sum,investment)=>sum+investmentMetrics(investment).value,0);
  $('#total-balance-value').textContent=money.format(total);
  const parts=[];
  if(!state.accounts.length)parts.push('Agrega tus cuentas en «Cuentas» para ver aquí tu saldo.');
  else{parts.push(`En tus cuentas: ${money.format(have)}`);if(credit.length)parts.push(`tarjetas: ${money.format(-owe)}`);}
  if(invested)parts.push(`inversiones aparte: ${money.format(invested)}`);
  $('#total-balance-note').textContent=parts.join(' · ');
}
setup();
setupTutorial();
setupReminderRepeat();
