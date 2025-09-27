// Простая реализация фронтенда + опциональный WebSocket режим.
// Работает автономно (localStorage) или с WS-сервером (ws://localhost:8080).
(() => {
  const IDS = {
    profileBlock: el('profileBlock'),
    profileAvatar: el('profileAvatar'),
    profileName: el('profileName'),
    profilePhone: el('profilePhone'),
    newChatBtn: el('newChatBtn'),
    modal: el('modal'),
    modalTitle: el('modalTitle'),
    modalName: el('modalName'),
    modalPhone: el('modalPhone'),
    modalCancel: el('modalCancel'),
    modalSave: el('modalSave'),
    chatsList: el('chatsList'),
    searchInput: el('searchInput'),
    chatHeader: el('chatHeader'),
    chatTitle: el('chatTitle'),
    chatSubtitle: el('chatSubtitle'),
    chatAvatar: el('chatAvatar'),
    messages: el('messages'),
    messageInput: el('messageInput'),
    sendBtn: el('sendBtn'),
    attachBtn: el('attachBtn'),
    fileInput: el('fileInput'),
    useServer: el('useServer'),
  };

  // Utils
  function el(id){ return document.getElementById(id) }
  function qs(s, root=document) { return root.querySelector(s) }
  function create(tag, cls) { const d = document.createElement(tag); if(cls) d.className = cls; return d }

  // Storage keys
  const STORAGE_KEY = 'minimessenger_v1';
  const state = loadState();

  // WS
  let ws = null;
  const WS_URL = 'ws://localhost:8080';

  // Initialize
  renderProfile();
  renderChats();
  bindEvents();
  maybeConnectWS();

  // --- state functions ---
  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) return JSON.parse(raw);
    } catch(e){}
    // default
    return {
      me: { id: uid(), name: 'Гость', phone: '', avatar: '' },
      contacts: [
        { id: 'contact-1', name: 'Андрей', phone: '+79991234567', avatar: '😀' }
      ],
      chats: {
        // chatId: { id, participants: [id,...], messages: [ {id, from, text, ts, img, status} ] }
      },
      activeChat: null,
    };
  }
  function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }

  // --- rendering ---
  function renderProfile(){
    IDS.profileName.textContent = state.me.name;
    IDS.profilePhone.textContent = state.me.phone;
    IDS.profileAvatar.src = state.me.avatar || avatarDataUrl(state.me.name);
  }

  function renderChats(filter=''){
    IDS.chatsList.innerHTML = '';
    // Ensure chat list exists for contacts
    state.contacts.forEach(c => {
      const chatId = chatIdFor(c.id);
      if(!state.chats[chatId]) state.chats[chatId] = { id: chatId, participants: [state.me.id, c.id], messages: [] };
    });

    const chats = Object.values(state.chats)
      .filter(c => {
        const otherId = c.participants.find(p => p !== state.me.id);
        const contact = state.contacts.find(x => x.id === otherId) || {name: otherId};
        return (!filter) || contact.name.toLowerCase().includes(filter.toLowerCase());
      })
      .sort((a,b) => {
        const ta = lastTs(a) || 0, tb = lastTs(b) || 0;
        return tb - ta;
      });

    chats.forEach(chat => {
      const li = create('li');
      const otherId = chat.participants.find(p => p !== state.me.id);
      const contact = state.contacts.find(x => x.id === otherId) || {name: otherId, avatar: ''};
      const av = create('img'); av.className = 'avatar small'; av.src = contact.avatar || avatarDataUrl(contact.name);
      const meta = create('div','meta');
      const name = create('div','name'); name.textContent = contact.name;
      const sub = create('div','muted'); sub.textContent = previewText(chat);
      meta.appendChild(name); meta.appendChild(sub);
      li.appendChild(av); li.appendChild(meta);
      li.addEventListener('click', () => openChat(chat.id));
      if(state.activeChat === chat.id) li.style.background = '#eef9ef';
      IDS.chatsList.appendChild(li);
    });
  }

  function openChat(chatId){
    state.activeChat = chatId;
    renderChats(IDS.searchInput.value);
    const chat = state.chats[chatId];
    const otherId = chat.participants.find(p => p !== state.me.id);
    const contact = state.contacts.find(x => x.id === otherId) || {name: otherId, phone:'', avatar:''};
    IDS.chatTitle.textContent = contact.name;
    IDS.chatSubtitle.textContent = contact.phone;
    IDS.chatAvatar.src = contact.avatar || avatarDataUrl(contact.name);
    renderMessages();
    saveState();
  }

  function renderMessages(){
    IDS.messages.innerHTML = '';
    if(!state.activeChat) return;
    const chat = state.chats[state.activeChat];
    chat.messages.forEach(m => {
      const div = create('div','msg ' + (m.from === state.me.id ? 'me' : 'other'));
      if(m.img){
        const img = create('img'); img.src = m.img; img.style.maxWidth='320px'; img.style.borderRadius='8px'; div.appendChild(img);
      }
      if(m.text){
        const p = create('div'); p.textContent = m.text; div.appendChild(p);
      }
      const meta = create('div','meta'); meta.textContent = new Date(m.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + (m.from === state.me.id ? ` · ${m.status||'sent'}` : '');
      div.appendChild(meta);
      IDS.messages.appendChild(div);
    });
    // scroll to bottom
    IDS.messages.scrollTop = IDS.messages.scrollHeight;
  }

  // --- helpers ---
  function uid(){ return 'id-' + Math.random().toString(36).slice(2,9) }
  function chatIdFor(contactId){ return [state.me.id, contactId].sort().join('--') }
  function lastTs(chat){ const m = chat.messages[chat.messages.length-1]; return m && m.ts }
  function previewText(chat){
    const m = chat.messages[chat.messages.length-1];
    if(!m) return 'Пустой чат';
    if(m.text) return m.text.length > 30 ? m.text.slice(0,30)+'…' : m.text;
    if(m.img) return '📷 Фото';
    return 'Сообщение';
  }
  function avatarDataUrl(name){
    const initials = (name || 'G').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
    // simple SVG avatar data URL
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%' height='100%' fill='#e6f4ea'/><text x='50%' y='55%' font-size='44' text-anchor='middle' fill='#2b6b3b' font-family='Arial' font-weight='600'>${initials}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // --- event bindings ---
  function bindEvents(){
    IDS.newChatBtn.addEventListener('click', () => openModal('Новый контакт', '', '', (name, phone) => {
      const id = uid();
      state.contacts.push({id, name: name || ('Контакт ' + (state.contacts.length+1)), phone, avatar: ''});
      const cid = chatIdFor(id);
      if(!state.chats[cid]) state.chats[cid] = { id: cid, participants: [state.me.id, id], messages: [] };
      saveState();
      renderChats();
    }));

    IDS.modalCancel.addEventListener('click', closeModal);
    IDS.modalSave.addEventListener('click', () => {
      const n = IDS.modalName.value.trim(), p = IDS.modalPhone.value.trim();
      if(IDS.modal.dataset.mode === 'profile') {
        state.me.name = n || state.me.name;
        state.me.phone = p || state.me.phone;
        state.me.avatar = avatarDataUrl(state.me.name);
        renderProfile();
        saveState();
        closeModal();
        return;
      }
      if(IDS.modal.dataset.callback){
        window._modalCallback && window._modalCallback(n,p);
      }
      closeModal();
    });

    // profile click opens profile modal
    IDS.profileBlock.addEventListener('click', () => {
      openModal('Настройка профиля', state.me.name, state.me.phone, null, 'profile');
    });

    IDS.searchInput.addEventListener('input', (e) => renderChats(e.target.value));
    IDS.sendBtn.addEventListener('click', sendMessageFromComposer);
    IDS.messageInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessageFromComposer(); }
    });

    IDS.attachBtn.addEventListener('click', () => IDS.fileInput.click());
    IDS.fileInput.addEventListener('change', handleAttach);

    IDS.useServer.addEventListener('change', (e) => {
      if(e.target.checked) connectWS(); else disconnectWS();
    });

    // typing indicator simulation:
    IDS.messageInput.addEventListener('input', () => {
      if(!state.activeChat) return;
      maybeSendTyping();
    });
  }

  function openModal(title, name='', phone='', callback=null, mode='contact'){
    IDS.modal.classList.remove('hidden');
    IDS.modalTitle.textContent = title;
    IDS.modalName.value = name;
    IDS.modalPhone.value = phone;
    IDS.modal.dataset.mode = mode;
    window._modalCallback = callback;
  }
  function closeModal(){ IDS.modal.classList.add('hidden'); window._modalCallback=null; }

  // send message logic (local first, then via WS if connected)
  function sendMessageFromComposer(){
    const text = IDS.messageInput.value.trim();
    const file = IDS.fileInput.files && IDS.fileInput.files[0];
    if(!state.activeChat){ alert('Выберите чат'); return; }
    if(!text && !file) return;
    if(file){
      const reader = new FileReader();
      if(file.size > 10*1024*1024) { alert('Файл слишком большой (макс 10МБ)'); return; }
      reader.onload = () => {
        createAndSend({ text: text || '', img: reader.result });
        IDS.fileInput.value = '';
      };
      reader.readAsDataURL(file);
    } else {
      createAndSend({ text });
    }
    IDS.messageInput.value = '';
  }

  function createAndSend({text='', img=null}){
    const m = { id: uid(), from: state.me.id, text, img, ts: Date.now(), status: '✔' };
    const chat = state.chats[state.activeChat];
    chat.messages.push(m);
    saveState();
    renderMessages();
    // Try to send over WS
    if(ws && ws.readyState === WebSocket.OPEN){
      ws.send(JSON.stringify({ type: 'message', chatId: chat.id, message: m }));
      // mark delivered locally when server echoes back (here we'll optimistic mark after send)
    } else {
      // in local-only mode we simulate deliver/read after timeout
      setTimeout(()=> {
        m.status = '✔✔'; saveState(); renderMessages();
      }, 800);
      setTimeout(()=> {
        m.status = '⚪'; saveState(); renderMessages();
      }, 2200);
    }
  }

  function handleAttach(e){
    // nothing here, sendMessage handles reader
  }

  // Typing indicator: broadcast to server or simulate to contact
  let typingTimeout = null;
  function maybeSendTyping(){
    if(!state.activeChat) return;
    if(ws && ws.readyState === WebSocket.OPEN){
      ws.send(JSON.stringify({ type: 'typing', chatId: state.activeChat, from: state.me.id }));
    } else {
      // show 'печатает…' locally as simulation
      const prev = IDS.chatSubtitle.textContent;
      IDS.chatSubtitle.textContent = 'печатает…';
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(()=> IDS.chatSubtitle.textContent = prev, 1200);
    }
  }

  // --- WebSocket client ---
  function maybeConnectWS(){
    // auto-disable if server not reachable
    if(IDS.useServer.checked) connectWS();
  }

  function connectWS(){
    try {
      ws = new WebSocket(WS_URL);
    } catch(e){
      console.warn('WS init failed', e);
      ws = null;
      IDS.useServer.checked = false;
      return;
    }

    ws.addEventListener('open', () => {
      console.log('WS connected');
      ws.send(JSON.stringify({type:'hello', clientId: state.me.id, name: state.me.name }));
    });
    ws.addEventListener('message', (ev) => {
      try {
        const data = JSON.parse(ev.data);
        handleServerMessage(data);
      } catch(e){ console.warn('invalid ws msg', e) }
    });
    ws.addEventListener('close', () => {
      console.log('WS closed'); ws = null; IDS.useServer.checked = false;
    });
    ws.addEventListener('error', (e) => { console.warn('WS error', e); });
  }

  function disconnectWS(){
    if(ws) ws.close();
    ws = null;
  }

  function handleServerMessage(data){
    if(data.type === 'message'){
      const chat = state.chats[data.chatId] || (state.chats[data.chatId] = { id: data.chatId, participants: data.participants || [], messages: [] });
      // If message already present (same id) ignore
      if(chat.messages.find(m => m.id === data.message.id)) return;
      chat.messages.push(data.message);
      // If message is from me and server echoes, mark delivered
      if(data.message.from === state.me.id){
        const m = chat.messages.find(x=>x.id===data.message.id);
        if(m) { m.status = 'delivered' }
      }
      saveState();
      renderChats(IDS.searchInput.value);
      if(state.activeChat === chat.id) renderMessages();
    } else if(data.type === 'typing'){
      const other = data.fromName || data.from;
      const prev = IDS.chatSubtitle.textContent;
      IDS.chatSubtitle.textContent = `${other} печатает…`;
      setTimeout(()=> { IDS.chatSubtitle.textContent = prev }, 1200);
    } else if(data.type === 'hello'){
      // optional presence
    }
  }

  // expose quick debug
  window._mm_state = state;
})();
