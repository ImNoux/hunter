import { initializeApp } from "https://esm.sh/firebase/app";
import { getDatabase, ref, push, onValue, query, orderByChild, update, off, get, child, set, increment } from "https://esm.sh/firebase/database";

const DEFAULT_AVATAR = "https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg";

const firebaseConfig = {
    apiKey: "AIzaSyDM9E8Y_YW-ld8MH8-yKS345hklA0v5P_w",
    authDomain: "hunterteam.firebaseapp.com",
    databaseURL: "https://hunterteam-default-rtdb.firebaseio.com",
    projectId: "hunterteam",
    storageBucket: "hunterteam.firebasestorage.app",
    messagingSenderId: "1001713111500",
    appId: "1:1001713111500:web:8729bf9a47a7806f6c4d69"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const threadsRef = ref(db, 'threads');
const usersRef = ref(db, 'users'); 
const verifiedRef = ref(db, 'verified'); 

// VARIABLES GLOBALES
let searchTerm = ''; 
let currentSection = 'Home'; 
let viewingUserProfile = ''; 
let viewingSinglePostId = null; 
let allThreadsData = []; 
let verifiedUsersList = []; 
let allUsersMap = {}; 
let myFollowingList = []; 
let myBlockedList = []; 
let userBeingReported = ''; 
let postBeingReported = null;
let lastScrollTop = 0;
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle');
    toast.innerHTML = `<span><i class="fas fa-${icon}"></i> ${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

window.showConfirm = function(message, callback) {
    const modal = document.getElementById('confirmModal');
    const text = document.getElementById('confirmText');
    const btn = document.getElementById('confirmActionBtn');
    if(modal && text && btn) {
        text.textContent = message;
        modal.style.display = 'block';
        btn.onclick = () => { callback(); modal.style.display = 'none'; };
    }
};

window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("Copiado al portapapeles", "success");
    });
};

function makeLinksClickable(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" style="color:#00a2ff; text-decoration:underline;">${url}</a>`);
}

function formatCount(num) {
    if (!num || num < 0) return 0; 
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' mill.';
    if (num >= 1000) {
        let val = (num / 1000).toFixed(1).replace(/\.0$/, '');
        if (val === '1000') return '1 mill.';
        return val + ' mil';
    }
    return num;
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return "";
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000); 
    if (diff < 60) return "hace un momento";
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} d`;
    
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const currentYear = new Date().getFullYear();
    if (year === currentYear) { return `${day}/${month}`; } 
    else { return `${day}/${month}/${year}`; }
}

window.getUserId = function() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
}

// ANIMACIÓN SCROLL
window.addEventListener("scroll", function() {
    let st = window.pageYOffset || document.documentElement.scrollTop;
    if (st > lastScrollTop && st > 60) {
        document.getElementById("mainHeader").classList.add("scroll-hide");
        document.getElementById("mainBottomNav").classList.add("scroll-hide");
        document.getElementById("floatingAddBtn").classList.add("scroll-hide");
        document.getElementById("searchContainer").classList.add("scroll-hide");
    } else {
        document.getElementById("mainHeader").classList.remove("scroll-hide");
        document.getElementById("mainBottomNav").classList.remove("scroll-hide");
        document.getElementById("floatingAddBtn").classList.remove("scroll-hide");
        document.getElementById("searchContainer").classList.remove("scroll-hide");
    }
    lastScrollTop = st <= 0 ? 0 : st;
}, false);

// FIREBASE LISTENER
function initFirebaseListener() {
    onValue(usersRef, (snap) => { 
        allUsersMap = snap.val() || {}; 
        const myUser = localStorage.getItem('savedRobloxUser');
        if (myUser && allUsersMap[myUser] && allUsersMap[myUser].isBanned === true) {
            showToast("Tu cuenta ha sido suspendida", "error");
            localStorage.clear();
            setTimeout(() => { window.location.reload(); }, 3000);
            return;
        }
        const btnAdmin = document.getElementById('btnAdminPanel');
        if(btnAdmin) {
            if(myUser && allUsersMap[myUser] && allUsersMap[myUser].role === 'admin') btnAdmin.style.display = 'block';
            else btnAdmin.style.display = 'none';
        }
        if (myUser && allUsersMap[myUser]) {
            myFollowingList = allUsersMap[myUser].following ? Object.keys(allUsersMap[myUser].following) : [];
            myBlockedList = allUsersMap[myUser].blocked ? Object.keys(allUsersMap[myUser].blocked) : [];
        } else {
            myFollowingList = []; myBlockedList = [];
        }
        if (allThreadsData.length > 0) renderCurrentView(); 
    });
    onValue(query(threadsRef, orderByChild('timestamp')), (snap) => {
        const data = snap.val(); allThreadsData = data ? Object.entries(data).sort((a,b) => b[1].timestamp - a[1].timestamp) : []; renderCurrentView();
    });
    onValue(verifiedRef, (snap) => {
        const data = snap.val(); verifiedUsersList = data ? Object.keys(data).map(n => n.toLowerCase()) : []; renderCurrentView();
    });
}

// LOGIN
window.loginSystem = async function() {
    const u = document.getElementById('loginUser').value.trim(); const p = document.getElementById('loginPin').value.trim();
    const btn = document.querySelector('#loginModal button'); const originalText = btn.innerText; btn.innerText = "Verificando..."; btn.disabled = true;
    try {
        const s = await get(child(usersRef, u));
        if (s.exists()) {
            const userData = s.val();
            if (userData.isBanned === true) { btn.innerText = originalText; btn.disabled = false; return showToast("Cuenta suspendida", "error"); }
            if (userData.pin == p) {
                const updates = {}; let needsUpdate = false;
                if (!userData.location) { try { const res = await fetch('https://ipapi.co/json/'); const data = await res.json(); if (data.city && data.country_name) { updates['location'] = `${data.city}, ${data.country_name}`; needsUpdate = true; } } catch(err) {} }
                if (!userData.registeredAt) { updates['registeredAt'] = Date.now(); needsUpdate = true; }
                if (needsUpdate) await update(ref(db, `users/${u}`), updates);
                localStorage.setItem('savedRobloxUser', u); localStorage.setItem('userId', 'res_' + u); window.location.reload();
            } else { document.getElementById('loginErrorModal').style.display = 'block'; btn.innerText = originalText; btn.disabled = false; }
        } else { showToast("Usuario no encontrado", "error"); btn.innerText = originalText; btn.disabled = false; }
    } catch(e) { showToast("Error conexión", "error"); btn.innerText = originalText; btn.disabled = false; }
};

// REGISTRO
window.registerSystem = async function() {
    const u = document.getElementById('regUser').value.trim(); const p = document.getElementById('regPin').value.trim();
    if(p.length < 4) return showToast("PIN muy corto", "error"); if(u.length < 3) return showToast("Usuario muy corto", "error");
    const btn = document.querySelector('#registerModal button'); btn.innerText = "Registrando..."; btn.disabled = true;
    try {
        const s = await get(child(usersRef, u));
        if (s.exists()) { btn.innerText = "REGISTRARSE"; btn.disabled = false; return showToast("ID de usuario en uso", "error"); }
        const isHandleTaken = Object.values(allUsersMap).some(user => user.customHandle && user.customHandle.toLowerCase() === u.toLowerCase());
        if (isHandleTaken) { btn.innerText = "REGISTRARSE"; btn.disabled = false; return showToast("Este nombre de usuario (@) ya existe", "error"); }
        let userLocation = "Desconocida"; try { const res = await fetch('https://ipapi.co/json/'); const data = await res.json(); if (data.city && data.country_name) userLocation = `${data.city}, ${data.country_name}`; } catch(err) {}
        await set(child(usersRef, u), { pin: p, displayName: u, customHandle: u, registeredAt: Date.now(), followersCount: 0, followingCount: 0, location: userLocation });
        localStorage.setItem('savedRobloxUser', u); window.location.reload();
    } catch(e) { showToast("Error", "error"); btn.innerText = "REGISTRARSE"; btn.disabled = false; }
};

window.logoutSystem = function() { showConfirm("¿Cerrar sesión?", () => { localStorage.clear(); window.location.reload(); }); };
window.changeSection = function(sectionName) {
    currentSection = sectionName; localStorage.setItem('lastSection', sectionName);
    if(sectionName !== 'Perfil') { localStorage.removeItem('lastVisitedProfile'); viewingUserProfile = ''; }
    if (sectionName !== 'Home') viewingSinglePostId = null;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const sc = document.getElementById('searchContainer');
    if(sectionName === 'Busqueda') { document.getElementById('nav-search').classList.add('active'); if(sc) sc.style.display = 'block'; }
    else { if(sc) sc.style.display = 'none'; const map = { Home: 'nav-home', Activity: 'nav-activity', Perfil: 'nav-profile' }; if(map[sectionName]) document.getElementById(map[sectionName]).classList.add('active'); }
    renderCurrentView(); if(sectionName === 'Home') window.scrollTo(0,0);
};

window.openMyProfile = function() { viewingUserProfile = ''; localStorage.removeItem('lastVisitedProfile'); changeSection('Perfil'); };
window.openFullProfile = (u) => { viewingUserProfile = u; localStorage.setItem('lastVisitedProfile', u); changeSection('Perfil'); };

function renderCurrentView() {
    const container = document.querySelector('.thread-container'); if(!container) return; container.innerHTML = '';
    if (currentSection === 'Activity') return renderActivity(container);
    if (currentSection === 'Perfil') return renderFullProfile(container);
    if (currentSection === 'Busqueda') { renderUserSearch(container); if (searchTerm) renderPostList(container, true); return; }
    renderPostList(container, false);
}
window.updateImageCounter = function(carousel) {
    const width = carousel.offsetWidth; const currentIndex = Math.round(carousel.scrollLeft / width) + 1;
    const totalImages = carousel.childElementCount; const badge = carousel.parentElement.querySelector('.image-counter-badge'); if(badge) badge.innerText = `${currentIndex}/${totalImages}`;
};

function renderThread(key, thread, container) {
    const div = document.createElement('div'); div.className = 'thread';
    const authorName = thread.username || "Desconocido"; const authorData = allUsersMap[authorName] || {};
    const myUser = localStorage.getItem('savedRobloxUser'); const isVerified = authorName && verifiedUsersList.includes(authorName.toLowerCase());
    const verifiedIconHTML = isVerified ? '<i class="fas fa-check-circle verified-icon"></i>' : '';
    const isMe = (myUser === authorName); const isFollowing = myFollowingList.includes(authorName); const timeAgo = formatTimeAgo(thread.timestamp);
    
    let avatarHTML = `<img src="${authorData.avatar || DEFAULT_AVATAR}" class="user-avatar-small" onclick="openFullProfile('${authorName}')">`;
    if (!isMe && myUser && !isFollowing) {
        avatarHTML = `<div class="avatar-wrapper" onclick="toggleMiniMenu(this)"><img src="${authorData.avatar || DEFAULT_AVATAR}" class="user-avatar-small"><div class="plus-badge"><i class="fas fa-plus"></i></div><div class="mini-action-menu"><div onclick="event.stopPropagation(); openFullProfile('${authorName}')"><i class="far fa-user"></i> Perfil</div><div onclick="event.stopPropagation(); toggleFollow('${authorName}');"><i class="fas fa-plus-circle"></i> Seguir</div></div></div>`;
    }
    
    let optionsMenuHTML = `<div class="post-header-right"><button class="options-btn" onclick="togglePostOptions('${key}')"><i class="fas fa-ellipsis-h"></i></button><div id="opts-${key}" class="post-options-dropdown"><div class="post-option-item" onclick="copyPostLink('${key}')"><span>Copiar enlace</span> <i class="fas fa-link"></i></div>${(!isMe && myUser) ? `<div class="post-option-item" onclick="reportPost('${key}', '${authorName}')"><span>Denunciar</span> <i class="fas fa-exclamation-circle" style="color:#ff4d4d;"></i></div><div class="post-option-item danger" onclick="blockUser('${authorName}')"><span>Bloquear</span> <i class="fas fa-user-slash"></i></div>` : ''}</div></div>`;
    
    let mediaHTML = '';
    if(thread.images && thread.images.length > 1) mediaHTML = `<div class="media-wrapper"><div class="media-carousel" onscroll="updateImageCounter(this)">${thread.images.map(img => `<img src="${img}">`).join('')}</div><div class="image-counter-badge">1/${thread.images.length}</div></div>`;
    else if (thread.images && thread.images.length === 1) mediaHTML = `<img src="${thread.images[0]}" style="width:100%; margin-top:10px; border-radius:8px;">`;
    else if(thread.image) mediaHTML = `<img src="${thread.image}" style="width:100%; margin-top:10px; border-radius:8px;">`;
    
    const userId = getUserId(); const likes = thread.likes || {}; const isLiked = likes[userId] ? 'liked' : ''; const commentCount = thread.comments ? Object.keys(thread.comments).length : 0;
    
    div.innerHTML = `<div class="post-header">${avatarHTML}<div class="user-info-display"><div class="username-row"><span class="username-styled" onclick="openFullProfile('${authorName}')">${authorData.displayName || authorName}</span><span class="post-time-inline">${timeAgo}</span></div><div class="user-rank-styled" style="display:flex; flex-direction:column;"><span>${thread.category || "Miembro"}</span><span style="color:#00a2ff; font-size:0.9em; margin-top:2px;">@${authorData.customHandle || authorName} ${verifiedIconHTML}</span></div></div>${optionsMenuHTML}</div><h3 style="margin:5px 0;">${thread.title}</h3><p>${makeLinksClickable(thread.description)}</p>${mediaHTML}<div class="thread-actions"><button class="like-button ${isLiked}" onclick="toggleLike('${key}', ${thread.likeCount||0}, this)"><i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> ${formatCount(thread.likeCount)}</button><button onclick="openComments('${key}')"><i class="far fa-comment"></i> ${formatCount(commentCount)}</button></div>`;
    container.appendChild(div);
}

window.togglePostOptions = function(key) { document.querySelectorAll('.post-options-dropdown.show').forEach(el => { if(el.id !== `opts-${key}`) el.classList.remove('show'); }); const menu = document.getElementById(`opts-${key}`); if(menu) menu.classList.toggle('show'); };
window.addEventListener('click', function(e) { if (!e.target.closest('.post-header-right')) document.querySelectorAll('.post-options-dropdown.show').forEach(el => el.classList.remove('show')); });
window.toggleMiniMenu = function(element) { document.querySelectorAll('.mini-action-menu.show').forEach(el => { if(el !== element.querySelector('.mini-action-menu')) el.classList.remove('show'); }); const menu = element.querySelector('.mini-action-menu'); if(menu) menu.classList.toggle('show'); }
document.addEventListener('click', function(e) { if(!e.target.closest('.avatar-wrapper')) document.querySelectorAll('.mini-action-menu.show').forEach(el => el.classList.remove('show')); });
function renderFullProfile(container) {
    const target = viewingUserProfile || localStorage.getItem('savedRobloxUser'); if (!target) return showToast("Inicia sesión", "error");
    const ud = allUsersMap[target] || {}; const myUser = localStorage.getItem('savedRobloxUser'); const isMe = target === myUser;
    const isVerified = verifiedUsersList.includes(target.toLowerCase()); const verifiedIconHTML = isVerified ? '<i class="fas fa-check-circle verified-icon" style="color:#0095f6;"></i>' : '';
    const amIAdmin = allUsersMap[myUser]?.role === 'admin'; const isBanned = ud.isBanned === true; const isBlockedByMe = myBlockedList.includes(target);
    let displayNameToShow = ud.displayName || target; let avatarToShow = ud.avatar || DEFAULT_AVATAR; let bioToShow = ud.bio || "Sin biografía"; let handleToShow = ud.customHandle || target;
    if (isBanned) { if (amIAdmin) displayNameToShow += " (SUSPENDIDO)"; else { displayNameToShow = "Usuario Eliminado"; avatarToShow = DEFAULT_AVATAR; bioToShow = ""; handleToShow = ""; } }
    const isFollowing = myFollowingList.includes(target); const followBtnText = isFollowing ? "Siguiendo" : "Seguir"; const btnClass = isFollowing ? "btn-profile-secondary" : "btn-profile-primary"; 
    const userStatus = (ud.status && ud.status.trim() !== "" && !isBanned) ? `<div class="status-pill">${ud.status}</div>` : '';
    let actionButtons = '';
    if (isMe) actionButtons = `<button onclick="openEditProfileModal()" class="btn-profile-secondary">Editar perfil</button><button onclick="copyProfileUrl('${target}')" class="btn-profile-secondary">Compartir perfil</button>`;
    else { if (amIAdmin && isBanned) actionButtons = `<button onclick="unbanUser('${target}')" style="background:#00e676; width:100%; font-weight:bold; color:black; border-radius:8px; padding:8px;">DESBANEAR USUARIO</button>`; else if (!isBanned) { if (isBlockedByMe) actionButtons = `<button onclick="unblockUser('${target}')" class="btn-profile-secondary" style="width:100%;">Desbloquear</button>`; else actionButtons = `<button onclick="toggleFollow('${target}')" class="${btnClass}">${followBtnText}</button>${amIAdmin ? `<button onclick="banUser('${target}')" style="background:#500; width:40px; color:white; border-radius:8px; border:none;"><i class="fas fa-ban"></i></button>` : ''}`; } }
    
    // MENÚ SUPERIOR (3 LÍNEAS si soy yo, 3 PUNTOS si es otro)
    let topMenuHTML = ''; if (isMe) topMenuHTML = `<button class="profile-hamburger-btn" onclick="openProfileSettings()"><i class="fas fa-bars"></i></button>`; else topMenuHTML = `<button class="profile-menu-btn" onclick="openProfileOptions('${target}')"><i class="fas fa-ellipsis-v"></i></button>`;
    
    const statsHTML = !isBanned && !isBlockedByMe ? `<div class="profile-stats-bar"><div class="p-stat" onclick="openListModal('following', '${target}')"><span>${formatCount(ud.followingCount)}</span><label>Siguiendo</label></div><div class="p-stat" onclick="openListModal('followers', '${target}')"><span>${formatCount(ud.followersCount)}</span><label>Seguidores</label></div></div>` : '';
    const header = document.createElement('div'); header.className = 'profile-header-container';
    header.innerHTML = `${topMenuHTML}<div class="profile-top-section"><div class="avatar-wrapper" style="cursor:default; position:relative;">${userStatus}<img src="${avatarToShow}" class="profile-avatar-big"></div><div class="username-large">${displayNameToShow}</div><div class="handle-large" onclick="copyToClipboard('@${handleToShow}')">@${handleToShow} ${verifiedIconHTML}</div></div><div class="profile-bio-section">${makeLinksClickable(bioToShow)}</div>${statsHTML}<div class="profile-action-buttons">${actionButtons}</div>`;
    container.appendChild(header);
    if (!isBanned && !isBlockedByMe) allThreadsData.forEach(([k, t]) => { if(t.username === target) renderThread(k, t, container); }); else if (isBlockedByMe) container.innerHTML += '<p style="text-align:center; padding:40px; color:#777;">Has bloqueado a este usuario.</p>';
}

function renderPostList(container, isSearch) {
    if (viewingSinglePostId) { const postEntry = allThreadsData.find(x => x[0] === viewingSinglePostId); if (postEntry) { const author = postEntry[1].username; container.innerHTML = `<button onclick="openFullProfile('${author}')" style="background:none; color:#00a2ff; border:none; padding:10px 0; cursor:pointer; width:100%; text-align:left; margin-bottom:10px; font-size:1em; display:flex; align-items:center; gap:8px;"><i class="fas fa-arrow-left"></i> Ver más de @${author}</button>`; } else container.innerHTML = `<button onclick="window.location.reload()" style="background:none; color:#ff4d4d; border:none; padding:10px;">Publicación no encontrada. Ir al inicio.</button>`; }
    const filtered = allThreadsData.filter(([k, t]) => { if (viewingSinglePostId) return k === viewingSinglePostId; const author = allUsersMap[t.username]; if (author && author.isBanned === true) return false; if (myBlockedList.includes(t.username)) return false; if (!isSearch) return true; const term = searchTerm.toLowerCase(); const tUser = t.username || ""; const tTitle = t.title || ""; return tTitle.toLowerCase().includes(term) || tUser.toLowerCase().includes(term); });
    if (filtered.length) filtered.forEach(([k, t]) => renderThread(k, t, container)); else if (!viewingSinglePostId) container.innerHTML += '<p style="text-align:center; padding:20px; color:#777;">Sin resultados.</p>';
}

function renderUserSearch(container) {
    if (!searchTerm) { container.innerHTML = '<p style="text-align:center; color:#777; margin-top:20px;">Busca personas...</p>'; return; }
    const term = searchTerm.toLowerCase(); const myUser = localStorage.getItem('savedRobloxUser'); const amIAdmin = allUsersMap[myUser]?.role === 'admin';
    Object.keys(allUsersMap).filter(u => u.toLowerCase().includes(term) || (allUsersMap[u].displayName && allUsersMap[u].displayName.toLowerCase().includes(term))).forEach(username => {
        const uData = allUsersMap[username]; let topText = uData.customHandle || username; let bottomText = uData.displayName || username; let avatar = uData.avatar || DEFAULT_AVATAR;
        const isVerified = verifiedUsersList.includes(username.toLowerCase()); const verifIcon = isVerified ? '<i class="fas fa-check-circle verified-icon"></i>' : '';
        if (uData.isBanned === true) { if (amIAdmin) topText += " (BANEADO)"; else { topText = "Usuario Eliminado"; bottomText = ""; avatar = DEFAULT_AVATAR; } }
        if (myBlockedList.includes(username)) topText += " (Bloqueado)";
        const div = document.createElement('div'); div.className = 'user-search-result'; div.onclick = () => openFullProfile(username);
        div.innerHTML = `<img src="${avatar}" class="user-search-avatar"><div class="user-search-info"><h4 style="margin:0; color:#fff;">${topText} ${verifIcon}</h4><p style="color:#a8a8a8; margin:0;">${bottomText}</p></div>`; container.appendChild(div);
    });
}

function renderActivity(container) { const myUser = localStorage.getItem('savedRobloxUser'); if (!myUser) { container.innerHTML = '<p style="text-align:center; padding:30px;">Inicia sesión.</p>'; return; } container.innerHTML = '<h3 style="padding:15px; border-bottom:1px solid #333;">Actividad</h3>'; const myData = allUsersMap[myUser]; if (myData?.followers) Object.keys(myData.followers).forEach(f => { const fd = allUsersMap[f] || {}; const div = document.createElement('div'); div.className = 'activity-item'; div.innerHTML = `<img src="${fd.avatar || DEFAULT_AVATAR}" class="activity-avatar"> <div class="activity-text"><strong>${f}</strong> te siguió.</div>`; container.appendChild(div); }); else container.innerHTML += '<p style="text-align:center; padding:40px; color:#555;">Sin actividad.</p>'; }
// --- SISTEMA DE LISTAS (PÁGINA COMPLETA) ---
let currentListUser = ''; let currentActiveTab = '';
window.openListModal = function(initialTab, targetUser) { currentListUser = targetUser; const page = document.getElementById('userListPage'); page.style.display = 'flex'; document.getElementById('listPageTitle').innerText = targetUser; switchListTab(initialTab); };
window.closeUserListPage = function() { document.getElementById('userListPage').style.display = 'none'; };
window.switchListTab = function(tabName) {
    currentActiveTab = tabName; const myUser = localStorage.getItem('savedRobloxUser'); const targetData = allUsersMap[currentListUser] || {};
    document.getElementById('tab-followers').classList.remove('active'); document.getElementById('tab-following').classList.remove('active'); document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById('count-followers').innerText = formatCount(targetData.followersCount); document.getElementById('count-following').innerText = formatCount(targetData.followingCount);
    const container = document.getElementById('userListContainer'); container.innerHTML = ''; 
    if (tabName === 'followers' && targetData.privateFollowers === true && currentListUser !== myUser) { container.innerHTML = '<p style="text-align:center; padding:50px 20px; color:#777;">La lista de seguidores es privada.</p>'; return; }
    const listObj = tabName === 'followers' ? targetData.followers : targetData.following; const listArray = listObj ? Object.keys(listObj) : [];
    window.currentRenderedList = listArray; document.getElementById('userListSearch').value = ""; renderUserListInModal(listArray);
};
function renderUserListInModal(userArray) {
    const container = document.getElementById('userListContainer'); container.innerHTML = '';
    if (userArray.length === 0) { container.innerHTML = '<p style="text-align:center; padding:50px 20px; color:#777;">Lista vacía.</p>'; return; }
    userArray.forEach(username => {
        const uData = allUsersMap[username] || {}; const isVerified = verifiedUsersList.includes(username.toLowerCase()); const verifIcon = isVerified ? '<i class="fas fa-check-circle verified-icon"></i>' : '';
        const iAmFollowing = myFollowingList.includes(username); const isMe = username === localStorage.getItem('savedRobloxUser');
        let btnHTML = ''; if (!isMe) { if (iAmFollowing) btnHTML = `<button class="btn-small-follow btn-state-following" onclick="toggleFollowFromList('${username}')">Siguiendo</button>`; else btnHTML = `<button class="btn-small-follow btn-state-follow" onclick="toggleFollowFromList('${username}')">Seguir</button>`; }
        const div = document.createElement('div'); div.className = 'user-list-item';
        div.innerHTML = `<div class="user-list-info" onclick="closeUserListPage(); openFullProfile('${username}')"><img src="${uData.avatar || DEFAULT_AVATAR}" class="user-list-avatar"><div class="user-list-texts"><span class="user-list-name">${uData.customHandle || username} ${verifIcon}</span><span class="user-list-handle">${uData.displayName || username}</span></div></div>${btnHTML}`;
        container.appendChild(div);
    });
}
let touchStartX = 0; let touchEndX = 0; const listPage = document.getElementById('userListPage'); if(listPage) { listPage.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }); listPage.addEventListener('touchend', e => { touchEndX = e.changedTouches[0].screenX; if (touchEndX < touchStartX - 50 && currentActiveTab === 'following') switchListTab('followers'); if (touchEndX > touchStartX + 50 && currentActiveTab === 'followers') switchListTab('following'); }); }
window.toggleFollowFromList = function(target) { window.toggleFollow(target); setTimeout(() => { const term = document.getElementById('userListSearch').value.toLowerCase(); const filtered = window.currentRenderedList.filter(u => u.toLowerCase().includes(term)); renderUserListInModal(filtered); }, 200); };
document.getElementById('userListSearch').oninput = function(e) { const term = e.target.value.toLowerCase(); const filtered = window.currentRenderedList.filter(u => { const ud = allUsersMap[u] || {}; const dName = ud.displayName || ""; return u.toLowerCase().includes(term) || dName.toLowerCase().includes(term); }); renderUserListInModal(filtered); };

window.openNewThreadPage = function() { const user = localStorage.getItem('savedRobloxUser'); if(!user) return showToast("Inicia sesión", "error"); document.getElementById('newThreadPage').style.display = 'flex'; };
window.closeNewThreadPage = function() { document.getElementById('newThreadPage').style.display = 'none'; };
window.submitNewThread = async function() {
    const user = localStorage.getItem('savedRobloxUser'); if(!user) return showToast("Inicia sesión", "error");
    const btn = document.getElementById('submitBtnHeader'); btn.disabled = true; btn.innerText = "Subiendo...";
    let imgs = []; const files = document.getElementById('imageFile').files;
    for (let i = 0; i < files.length; i++) { const fd = new FormData(); fd.append('file', files[i]); fd.append('upload_preset', 'comunidad_arc'); try { const res = await fetch(`https://api.cloudinary.com/v1_1/dmrlmfoip/auto/upload`, { method: 'POST', body: fd }); const data = await res.json(); imgs.push(data.secure_url); } catch(err) {} }
    const post = { title: document.getElementById('title').value, description: document.getElementById('description').value, category: document.getElementById('categorySelect').value, username: user, images: imgs, image: imgs.length > 0 ? imgs[0] : "", timestamp: Date.now(), likeCount: 0 };
    await push(threadsRef, post); document.getElementById('newThreadForm').reset(); document.getElementById('fileName').textContent = ""; closeNewThreadPage(); showToast("Publicado", "success"); btn.disabled = false; btn.innerText = "Publicar"; changeSection('Home');
};
// --- NUEVAS FUNCIONES DE AJUSTES (3 LÍNEAS - MI PERFIL) ---
window.openProfileSettings = function() { document.getElementById('profileSettingsModal').style.display = 'block'; };

// PÁGINA DE BLOQUEADOS
window.openBlockedPage = function() { closeModal('profileSettingsModal'); document.getElementById('blockedPage').style.display = 'flex'; renderBlockedList(); };
function renderBlockedList() { const container = document.getElementById('blockedListContainer'); container.innerHTML = ''; if (myBlockedList.length === 0) { container.innerHTML = '<p style="text-align:center; padding:40px; color:#777;">No has bloqueado a nadie.</p>'; return; } myBlockedList.forEach(user => { const uData = allUsersMap[user] || {}; const div = document.createElement('div'); div.className = 'user-list-item'; div.innerHTML = `<div class="user-list-info"><img src="${uData.avatar || DEFAULT_AVATAR}" class="user-list-avatar"><div class="user-list-texts"><span class="user-list-name">${uData.customHandle || user}</span><span class="user-list-handle" style="color:#777;">Bloqueado</span></div></div><button class="btn-unblock" onclick="unblockFromList('${user}')">Desbloquear</button>`; container.appendChild(div); }); }
window.unblockFromList = function(targetUser) { const myUser = localStorage.getItem('savedRobloxUser'); set(ref(db, `users/${myUser}/blocked/${targetUser}`), null).then(() => { showToast(`Desbloqueaste a ${targetUser}`, "success"); setTimeout(() => renderBlockedList(), 500); }); };

// PÁGINA DE MI INFORMACIÓN
window.openMyInfoPage = function() { closeModal('profileSettingsModal'); currentProfileTarget = localStorage.getItem('savedRobloxUser'); const uData = allUsersMap[currentProfileTarget] || {}; document.getElementById('myInfoAvatar').src = uData.avatar || DEFAULT_AVATAR; document.getElementById('myInfoName').innerText = uData.displayName || currentProfileTarget; let dateStr = "Desconocida"; if (uData.registeredAt) { const date = new Date(uData.registeredAt); const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]; dateStr = `${months[date.getMonth()]} de ${date.getFullYear()}`; } document.getElementById('myInfoDate').innerText = dateStr; document.getElementById('myInfoLocation').innerText = uData.location || "Ubicación no disponible"; document.getElementById('myInfoPage').style.display = 'flex'; };

// --- OPCIONES DE OTROS PERFILES (3 PUNTOS) ---
let currentProfileTarget = '';
window.openProfileOptions = function(targetUser) { currentProfileTarget = targetUser; const myUser = localStorage.getItem('savedRobloxUser'); const isMe = (targetUser === myUser); const dangerItems = document.querySelectorAll('#profileOptionsModal .sheet-item.danger'); dangerItems.forEach(el => el.style.display = isMe ? 'none' : 'block'); document.getElementById('profileOptionsModal').style.display = 'block'; };
window.confirmBlockUser = function() { closeModal('profileOptionsModal'); blockUser(currentProfileTarget); };
window.confirmReportUser = function() { closeModal('profileOptionsModal'); reportUser(currentProfileTarget); };
window.copyProfileUrl = function(target) { const userToCopy = target || currentProfileTarget; const url = `${window.location.origin}${window.location.pathname}#profile_${userToCopy}`; navigator.clipboard.writeText(url).then(() => { showToast("Enlace del perfil copiado", "success"); if(!target) closeModal('profileOptionsModal'); }); };
window.copyPostLink = function(key) { const link = `${window.location.origin}${window.location.pathname}#post_${key}`; navigator.clipboard.writeText(link).then(() => showToast("Enlace de publicación copiado", "success")); };

window.showAccountInfo = function() {
    closeModal('profileOptionsModal'); closeModal('profileSettingsModal'); const uData = allUsersMap[currentProfileTarget] || {};
    document.getElementById('infoAvatar').src = uData.avatar || DEFAULT_AVATAR; document.getElementById('infoUsername').innerText = uData.displayName || currentProfileTarget;
    let dateStr = "Desconocida"; if (uData.registeredAt) { const date = new Date(uData.registeredAt); const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]; dateStr = `${months[date.getMonth()]} de ${date.getFullYear()}`; }
    document.getElementById('infoDate').innerText = dateStr; document.getElementById('infoLocation').innerText = uData.location || "Ubicación no disponible"; 
    document.getElementById('accountInfoPage').style.display = 'flex';
};

// --- EDITAR PERFIL ---
window.openEditProfileModal = function() { const d = allUsersMap[localStorage.getItem('savedRobloxUser')] || {}; document.getElementById('editAvatarPreview').src = d.avatar || DEFAULT_AVATAR; document.getElementById('editNameInput').value = d.displayName || ""; document.getElementById('editHandleInput').value = d.customHandle || ""; document.getElementById('editBioInput').value = d.bio || ""; document.getElementById('editStatusInput').value = d.status || ""; const modal = document.getElementById('editProfileModal'); if(modal) modal.style.display = 'block'; };
window.saveProfileChanges = async function() {
    const myUser = localStorage.getItem('savedRobloxUser'); const ud = allUsersMap[myUser] || {}; const now = Date.now(); const gap = 15 * 24 * 60 * 60 * 1000; 
    if (ud.lastProfileUpdate && (now - ud.lastProfileUpdate < gap)) { const left = Math.ceil((gap - (now - ud.lastProfileUpdate)) / (1000*60*60*24)); const newName = document.getElementById('editNameInput').value; const newHandle = document.getElementById('editHandleInput').value; if (newName !== ud.displayName || newHandle !== ud.customHandle) return showToast(`Espera ${left} días para cambiar tus nombres.`, "error"); }
    const newHandleInput = document.getElementById('editHandleInput').value.trim(); if (newHandleInput !== ud.customHandle) { const isTaken = Object.values(allUsersMap).some(user => user.customHandle && user.customHandle.toLowerCase() === newHandleInput.toLowerCase()); if (isTaken) return showToast("Este usuario (@) ya está en uso", "error"); }
    const btn = document.getElementById('saveProfileBtn'); btn.innerText = "Guardando...";
    const updates = { [`users/${myUser}/displayName`]: document.getElementById('editNameInput').value, [`users/${myUser}/customHandle`]: newHandleInput, [`users/${myUser}/bio`]: document.getElementById('editBioInput').value, [`users/${myUser}/status`]: document.getElementById('editStatusInput').value, [`users/${myUser}/lastProfileUpdate`]: now };
    try { await update(ref(db), updates); showToast("Perfil actualizado", "success"); document.getElementById('editProfileModal').style.display='none'; } catch(e) { showToast("Error", "error"); } finally { btn.innerText = "GUARDAR CAMBIOS"; }
};

// --- FLUJO DE REPORTES Y BLOQUEOS (TIPO INSTAGRAM) ---
window.blockUser = function(targetUser) { const myUser = localStorage.getItem('savedRobloxUser'); if (!myUser) return; showConfirm(`¿Bloquear a ${targetUser}?`, () => { const updates = {}; updates[`users/${myUser}/blocked/${targetUser}`] = true; updates[`users/${myUser}/following/${targetUser}`] = null; updates[`users/${targetUser}/followers/${myUser}`] = null; update(ref(db), updates).then(() => { showToast("Bloqueado.", "success"); renderCurrentView(); }); }); };
window.unblockUser = function(targetUser) { const myUser = localStorage.getItem('savedRobloxUser'); showConfirm(`¿Desbloquear a ${targetUser}?`, () => { set(ref(db, `users/${myUser}/blocked/${targetUser}`), null).then(() => { showToast("Desbloqueado.", "success"); renderCurrentView(); }); }); };
window.reportUser = function(targetUser) { userBeingReported = targetUser; postBeingReported = null; openReportModal(targetUser); };
window.reportPost = function(postKey, authorName) { userBeingReported = authorName; postBeingReported = postKey; openReportModal(authorName, true); };
function openReportModal(target, isPost = false) { const myUser = localStorage.getItem('savedRobloxUser'); if (!myUser) return showToast("Inicia sesión primero", "error"); if (myUser === target) return showToast("No puedes reportarte", "error"); document.getElementById('reportTargetName').innerText = isPost ? `Reportando publicación de: ${target}` : `Reportando a: ${target}`; document.getElementById('reportModal').style.display = 'block'; }

window.submitReportAction = function() {
    const reason = document.getElementById('reportReasonSelect').value; const myUser = localStorage.getItem('savedRobloxUser'); if (!userBeingReported) return;
    push(ref(db, 'reports'), { reportedUser: userBeingReported, reportedBy: myUser, reason: reason, timestamp: Date.now(), status: 'pending', postId: postBeingReported }).then(() => { 
        document.getElementById('reportModal').style.display = 'none';
        document.getElementById('reportSuccessUser').innerText = userBeingReported;
        document.getElementById('reportSuccessModal').style.display = 'block';
    });
};
window.openBlockConfirmModal = function() { closeModal('reportSuccessModal'); document.getElementById('blockTargetUser').innerText = userBeingReported; const targetData = allUsersMap[userBeingReported] || {}; document.getElementById('blockAvatarPreview').src = targetData.avatar || DEFAULT_AVATAR; document.getElementById('blockConfirmModal').style.display = 'block'; };
window.performBlockAction = function() { blockUserLogic(userBeingReported); closeModal('blockConfirmModal'); document.getElementById('finalThanksModal').style.display = 'block'; };
window.performBlockAndReportAction = function() { blockUserLogic(userBeingReported); closeModal('blockConfirmModal'); document.getElementById('finalThanksModal').style.display = 'block'; };
window.closeAllReportModals = function() { closeModal('finalThanksModal'); renderCurrentView(); };
function blockUserLogic(targetUser) { const myUser = localStorage.getItem('savedRobloxUser'); if (!myUser) return; const updates = {}; updates[`users/${myUser}/blocked/${targetUser}`] = true; updates[`users/${myUser}/following/${targetUser}`] = null; updates[`users/${targetUser}/followers/${myUser}`] = null; update(ref(db), updates); }

// --- ADMIN & INTERACCIONES ---
window.banUser = function(targetUser) { showConfirm(`¿Banear cuenta?`, () => { update(ref(db), { [`users/${targetUser}/isBanned`]: true }).then(() => showToast("Usuario baneado.", "success")); }); };
window.unbanUser = function(targetUser) { showConfirm(`¿Restaurar cuenta?`, () => { update(ref(db), { [`users/${targetUser}/isBanned`]: null }).then(() => showToast("Usuario restaurado.", "success")); }); };
window.openAdminPanel = function() { const myUser = localStorage.getItem('savedRobloxUser'); if (!allUsersMap[myUser] || allUsersMap[myUser].role !== 'admin') return showToast("Acceso denegado.", "error"); document.getElementById('adminModal').style.display = 'block'; get(child(ref(db), 'reports')).then((snapshot) => { const container = document.getElementById('adminReportsList'); if (snapshot.exists()) { container.innerHTML = ''; Object.entries(snapshot.val()).forEach(([key, r]) => { const div = document.createElement('div'); div.style.cssText = "background:#333; margin-bottom:10px; padding:10px; border-radius:8px; border:1px solid #555;"; div.innerHTML = `<div style="font-size:0.9em; color:#aaa;">Reportado: <b>${r.reportedUser}</b><br>Motivo: ${r.reason}</div><div style="margin-top:5px;"><button onclick="deleteReport('${key}')" style="background:#555; padding:5px;">Borrar</button> <button onclick="banUser('${r.reportedUser}')" style="background:#cc0000; padding:5px;">BANEAR</button></div>`; container.appendChild(div); }); } else { container.innerHTML = '<p style="text-align:center; color:#777;">Sin reportes.</p>'; } }); };
window.deleteReport = function(k) { set(ref(db, `reports/${k}`), null).then(() => { showToast("Borrado", "success"); window.openAdminPanel(); }); };
window.toggleFollow = function(target) { const me = localStorage.getItem('savedRobloxUser'); if(!me) { showToast("Regístrate", "error"); return; } if(me === target) return; const isFollowing = myFollowingList.includes(target); const updates = {}; if (isFollowing) { updates[`users/${me}/following/${target}`] = null; updates[`users/${target}/followers/${me}`] = null; updates[`users/${me}/followingCount`] = increment(-1); updates[`users/${target}/followersCount`] = increment(-1); } else { updates[`users/${me}/following/${target}`] = true; updates[`users/${target}/followers/${me}`] = true; updates[`users/${me}/followingCount`] = increment(1); updates[`users/${target}/followersCount`] = increment(1); } update(ref(db), updates); setTimeout(() => renderCurrentView(), 200); };
const searchIn = document.getElementById('searchInput'); if(searchIn) searchIn.oninput = (e) => { searchTerm = e.target.value.trim(); renderCurrentView(); };
window.toggleLike = (k, c, b) => { const u = localStorage.getItem('savedRobloxUser'); if(!u) return showToast("Inicia sesión", "error"); const id = getUserId(); const isL = b.querySelector('i').classList.contains('fas'); update(ref(db), { [`threads/${k}/likeCount`]: isL ? c - 1 : c + 1, [`threads/${k}/likes/${id}`]: isL ? null : true }); };
const avatarInput = document.getElementById('avatarUpload'); if(avatarInput) { avatarInput.onchange = async function() { const user = localStorage.getItem('savedRobloxUser'); if(!user || this.files.length === 0) return; showToast("Subiendo...", "info"); const formData = new FormData(); formData.append('file', this.files[0]); formData.append('upload_preset', 'comunidad_arc'); try { const res = await fetch(`https://api.cloudinary.com/v1_1/dmrlmfoip/auto/upload`, { method: 'POST', body: formData }); const data = await res.json(); await update(ref(db, `users/${user}`), { avatar: data.secure_url }); document.getElementById('editAvatarPreview').src = data.secure_url; showToast("Actualizado", "success"); } catch(e) { showToast("Error", "error"); } }; }
window.openComments = (key) => { const modal = document.getElementById('commentsModal'); const list = document.getElementById('commentsList'); modal.style.display = 'block'; off(ref(db, `threads/${key}/comments`)); onValue(ref(db, `threads/${key}/comments`), (snap) => { list.innerHTML = ''; const data = snap.val(); if(data) Object.values(data).forEach(c => { const d = document.createElement('div'); d.innerHTML = `<strong>${c.username}:</strong> ${makeLinksClickable(c.text)}`; d.style.cssText = "padding:5px 0; border-bottom:1px solid #333;"; list.appendChild(d); }); else list.innerHTML = '<p style="text-align:center; color:#777;">Sin comentarios.</p>'; }); const cForm = document.getElementById('commentForm'); const newForm = cForm.cloneNode(true); cForm.parentNode.replaceChild(newForm, cForm); newForm.onsubmit = (e) => { e.preventDefault(); const u = localStorage.getItem('savedRobloxUser'); if(!u) return showToast("Inicia sesión", "error"); push(ref(db, `threads/${key}/comments`), { text: document.getElementById('commentInput').value, username: u, timestamp: Date.now() }); document.getElementById('commentInput').value = ''; }; };
document.addEventListener('DOMContentLoaded', () => {
    initFirebaseListener();
    const user = localStorage.getItem('savedRobloxUser');
    if(user) { 
        document.getElementById('menuLogin').style.display = 'none'; 
        document.getElementById('menuLogout').style.display = 'block'; 
    }

    const hash = window.location.hash;
    if (hash.startsWith('#profile_')) {
        viewingUserProfile = hash.replace('#profile_', '');
        currentSection = 'Perfil';
    } else if (hash.startsWith('#post_')) {
        viewingSinglePostId = hash.replace('#post_', '');
        currentSection = 'Home';
    } else {
        const lastSection = localStorage.getItem('lastSection') || 'Home';
        if (lastSection === 'Perfil') {
            const savedProfile = localStorage.getItem('lastVisitedProfile');
            if (savedProfile) { viewingUserProfile = savedProfile; } 
            else if (user) { viewingUserProfile = ''; }
            else { if(typeof window.changeSection === 'function') window.changeSection('Home'); return; }
        }
        currentSection = lastSection;
    }

    if(typeof window.changeSection === 'function') {
        window.changeSection(currentSection);
    }
});