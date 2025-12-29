import { initializeApp } from "https://esm.sh/firebase/app";
import { getDatabase, ref, push, onValue, query, orderByChild, update, off, get, child, set, increment } from "https://esm.sh/firebase/database";
import { getMessaging, getToken, onMessage } from "https://esm.sh/firebase/messaging"; 

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

// Variables Skeleton y Pull
let isSkeletonShown = false;
let pullStartY = 0;
let isPulling = false;
const pullThreshold = 150; 
const refreshContainer = document.getElementById('pullToRefresh');
// --- CONTROL UI ---
window.toggleMainUI = function(show) {
    const display = show ? '' : 'none';
    const elements = ['mainHeader', 'mainBottomNav', 'floatingAddBtn', 'searchContainer'];
    elements.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = display; });
};

// --- PUSH NOTIFICATIONS ---
window.requestNotificationPermission = async function() {
    const messaging = getMessaging(app);
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showToast("Permiso concedido. Configurando...", "info");
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
                const currentToken = await getToken(messaging, { 
                    vapidKey: 'BCZrmsGsGLv6cFEEvDXYHtY5gHqF7WW8WpaZpO7_DDfD-IPT-OGmiuDFMbCcbv4h--EOGHIWJWp1-Afi2AIks5k',
                    serviceWorkerRegistration: registration
                });
                if (currentToken) {
                    const user = localStorage.getItem('savedRobloxUser');
                    if (user) {
                        await update(ref(db, `users/${user}`), { fcmToken: currentToken });
                        showToast("¡Notificaciones Push activadas!", "success");
                    } else { showToast("Inicia sesión para guardar config", "error"); }
                } else { showToast("Error al obtener token", "error"); }
            }
        } else { showToast("Permiso denegado", "error"); }
    } catch (error) { console.error(error); showToast("Error de configuración", "error"); }
};

const messaging = getMessaging(app);
onMessage(messaging, (payload) => {
    showToast(`🔔 ${payload.notification.title}: ${payload.notification.body}`, "info");
});

// --- UTILIDADES ---
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toastContainer'); if(!container) return;
    const toast = document.createElement('div'); toast.className = `toast ${type}`;
    let icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle');
    toast.innerHTML = `<span><i class="fas fa-${icon}"></i> ${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'fadeOut 0.5s forwards'; setTimeout(() => toast.remove(), 500); }, 3000);
};

window.showConfirm = function(message, callback) {
    const modal = document.getElementById('confirmModal'); const text = document.getElementById('confirmText'); const btn = document.getElementById('confirmActionBtn');
    if(modal && text && btn) { text.textContent = message; modal.style.display = 'block'; btn.onclick = () => { callback(); modal.style.display = 'none'; }; }
};

window.copyToClipboard = function(text) { navigator.clipboard.writeText(text).then(() => { showToast("Copiado al portapapeles", "success"); }); };
function makeLinksClickable(text) { if (!text) return ''; const urlRegex = /(https?:\/\/[^\s]+)/g; return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" style="color:#00a2ff; text-decoration:underline;">${url}</a>`); }
function formatCount(num) { if (!num || num < 0) return 0; if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' mill.'; if (num >= 1000) { let val = (num / 1000).toFixed(1).replace(/\.0$/, ''); if (val === '1000') return '1 mill.'; return val + ' mil'; } return num; }
function formatTimeAgo(timestamp) { if (!timestamp) return ""; const now = Date.now(); const diff = Math.floor((now - timestamp) / 1000); if (diff < 60) return "hace un momento"; const minutes = Math.floor(diff / 60); if (minutes < 60) return `${minutes} min`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} h`; const days = Math.floor(hours / 24); if (days < 7) return `${days} d`; const date = new Date(timestamp); const day = date.getDate().toString().padStart(2, '0'); const month = (date.getMonth() + 1).toString().padStart(2, '0'); const year = date.getFullYear(); const currentYear = new Date().getFullYear(); if (year === currentYear) { return `${day}/${month}`; } else { return `${day}/${month}/${year}`; } }
window.getUserId = function() { let userId = localStorage.getItem('userId'); if (!userId) { userId = 'user_' + Math.random().toString(36).substr(2, 9); localStorage.setItem('userId', userId); } return userId; }
window.addEventListener("scroll", function() { let st = window.pageYOffset || document.documentElement.scrollTop; const hide = st > lastScrollTop && st > 60; const elements = ['mainHeader', 'mainBottomNav', 'floatingAddBtn', 'searchContainer']; elements.forEach(id => { const el = document.getElementById(id); if(el) { if(hide) el.classList.add("scroll-hide"); else el.classList.remove("scroll-hide"); } }); lastScrollTop = st <= 0 ? 0 : st; }, false);
function initFirebaseListener() {
    // 1. USUARIOS
    onValue(usersRef, (snap) => { 
        allUsersMap = snap.val() || {}; 
        
        // Deep Linking
        const hash = window.location.hash;
        if (hash === '#my_info') { 
            const me = localStorage.getItem('savedRobloxUser'); 
            if (me && allUsersMap[me]) { toggleMainUI(false); openMyInfoPage(); }
        } 
        else if (hash.startsWith('#info_')) { 
            const target = hash.replace('#info_', ''); 
            if (allUsersMap[target]) { currentProfileTarget = target; toggleMainUI(false); showAccountInfo(); } 
        }
        else if (hash.startsWith('#profile_')) { 
            const target = hash.replace('#profile_', ''); 
            if (allUsersMap[target]) { toggleMainUI(false); viewingUserProfile = target; currentSection = 'Perfil'; renderCurrentView(); } 
        }

        // LÓGICA BOTÓN ADMIN
        const myUser = localStorage.getItem('savedRobloxUser');
        const btnAdmin = document.getElementById('btnAdminPanel');
        if(btnAdmin) btnAdmin.style.display = (myUser && allUsersMap[myUser] && allUsersMap[myUser].role === 'admin') ? 'block' : 'none';
        
        if (myUser && allUsersMap[myUser]) {
            if (allUsersMap[myUser].isBanned === true) { showToast("Cuenta suspendida", "error"); localStorage.clear(); setTimeout(() => { window.location.reload(); }, 3000); return; }
            myFollowingList = allUsersMap[myUser].following ? Object.keys(allUsersMap[myUser].following) : [];
            myBlockedList = allUsersMap[myUser].blocked ? Object.keys(allUsersMap[myUser].blocked) : [];
        }
        if (allThreadsData.length > 0) renderCurrentView(); 
    });

    // 2. FEED
    onValue(query(threadsRef), (snap) => {
        const data = snap.val();
        if (data) {
            const rawArray = Object.entries(data);
            if (allThreadsData.length === 0) {
                toggleSkeleton(true);
                setTimeout(() => {
                    allThreadsData = shuffleArray(rawArray);
                    toggleSkeleton(false); 
                    renderCurrentView();
                }, 800); 
            } else {
                const newMap = new Map(Object.entries(data));
                allThreadsData = allThreadsData.map(item => newMap.has(item[0]) ? [item[0], newMap.get(item[0])] : item);
                if (rawArray.length > allThreadsData.length) {
                     const currentKeys = new Set(allThreadsData.map(i => i[0]));
                     const newPosts = rawArray.filter(i => !currentKeys.has(i[0]));
                     allThreadsData = [...newPosts, ...allThreadsData];
                }
                renderCurrentView();
            }
        } else {
            allThreadsData = [];
            renderCurrentView();
        }
        const hash = window.location.hash;
        if (hash.startsWith('#post_')) { viewingSinglePostId = hash.replace('#post_', ''); currentSection = 'Home'; renderCurrentView(); }
    });
    onValue(verifiedRef, (snap) => { const data = snap.val(); verifiedUsersList = data ? Object.keys(data).map(n => n.toLowerCase()) : []; renderCurrentView(); });
}

function toggleSkeleton(show) { const sk = document.getElementById('skeletonLoader'); const real = document.getElementById('realContentContainer'); if (show) { if(sk) sk.style.display = 'block'; if(real) real.style.display = 'none'; isSkeletonShown = true; } else { if(sk) sk.style.display = 'none'; if(real) real.style.display = 'block'; isSkeletonShown = false; } }

// --- PULL TO REFRESH ---
window.addEventListener('touchstart', (e) => { if (window.scrollY === 0 && (currentSection === 'Home' || currentSection === 'Perfil')) { pullStartY = e.touches[0].clientY; isPulling = true; } }, { passive: true });
window.addEventListener('touchmove', (e) => { if (!isPulling) return; const y = e.touches[0].clientY; const diff = y - pullStartY; if (diff > 0 && window.scrollY === 0) { if (diff < pullThreshold) { if(refreshContainer) refreshContainer.style.height = `${diff / 2.5}px`; } } else { isPulling = false; if(refreshContainer) refreshContainer.style.height = '0px'; } }, { passive: true });
window.addEventListener('touchend', () => { if (!isPulling) return; isPulling = false; if (refreshContainer && refreshContainer.offsetHeight > 40) { performRefresh(); } else { if(refreshContainer) refreshContainer.style.height = '0px'; } });
function performRefresh() { if(refreshContainer) refreshContainer.style.height = '50px'; toggleSkeleton(true); setTimeout(() => { if (currentSection === 'Home' && allThreadsData.length > 0) { allThreadsData = shuffleArray(allThreadsData); } renderCurrentView(); if(refreshContainer) refreshContainer.style.height = '0px'; toggleSkeleton(false); showToast("Actualizado", "success"); }, 1200); }
function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
// --- RENDERIZADO ---
window.changeSection = function(sectionName) {
    currentSection = sectionName; localStorage.setItem('lastSection', sectionName);
    if(sectionName !== 'Perfil') { localStorage.removeItem('lastVisitedProfile'); viewingUserProfile = ''; }
    if (sectionName !== 'Home') viewingSinglePostId = null;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const sc = document.getElementById('searchContainer');
    toggleMainUI(true);
    if(sectionName === 'Busqueda') { document.getElementById('nav-search').classList.add('active'); if(sc) sc.style.display = 'block'; }
    else { if(sc) sc.style.display = 'none'; const map = { Home: 'nav-home', Activity: 'nav-activity', Perfil: 'nav-profile' }; if(map[sectionName]) document.getElementById(map[sectionName]).classList.add('active'); }
    
    // Resetear badge de actividad al entrar
    if (sectionName === 'Activity') {
        const badge = document.getElementById('activityBadge'); if(badge) badge.style.display = 'none';
    }
    renderCurrentView(); if(sectionName === 'Home') window.scrollTo(0,0);
};

window.openMyProfile = function() { viewingUserProfile = ''; localStorage.removeItem('lastVisitedProfile'); changeSection('Perfil'); };
window.openFullProfile = (u) => { viewingUserProfile = u; localStorage.setItem('lastVisitedProfile', u); changeSection('Perfil'); };

function renderCurrentView() {
    const container = document.getElementById('realContentContainer'); 
    if(!container) return; container.innerHTML = '';
    if (isSkeletonShown && allThreadsData.length === 0) return;
    if (currentSection === 'Activity') return renderActivity(container);
    if (currentSection === 'Perfil') return renderFullProfile(container);
    if (currentSection === 'Busqueda') { renderUserSearch(container); if (searchTerm) renderPostList(container, true); return; }
    renderPostList(container, false);
}
window.updateImageCounter = function(carousel) { const width = carousel.offsetWidth; const currentIndex = Math.round(carousel.scrollLeft / width) + 1; const totalImages = carousel.childElementCount; const badge = carousel.parentElement.querySelector('.image-counter-badge'); if(badge) badge.innerText = `${currentIndex}/${totalImages}`; };

function renderThread(key, thread, container) {
    const div = document.createElement('div'); div.className = 'thread';
    const authorName = thread.username || "Desconocido"; const authorData = allUsersMap[authorName] || {};
    const myUser = localStorage.getItem('savedRobloxUser'); const isVerified = authorName && verifiedUsersList.includes(authorName.toLowerCase());
    const verifiedIconHTML = isVerified ? '<i class="fas fa-check-circle verified-icon"></i>' : '';
    const isMe = (myUser === authorName); const isFollowing = myFollowingList.includes(authorName); const timeAgo = formatTimeAgo(thread.timestamp);
    let avatarHTML = `<img src="${authorData.avatar || DEFAULT_AVATAR}" class="user-avatar-small" onclick="openFullProfile('${authorName}')">`;
    if (!isMe && myUser && !isFollowing) { avatarHTML = `<div class="avatar-wrapper" onclick="toggleMiniMenu(this)"><img src="${authorData.avatar || DEFAULT_AVATAR}" class="user-avatar-small"><div class="plus-badge"><i class="fas fa-plus"></i></div><div class="mini-action-menu"><div onclick="event.stopPropagation(); openFullProfile('${authorName}')"><i class="far fa-user"></i> Perfil</div><div onclick="event.stopPropagation(); toggleFollow('${authorName}');"><i class="fas fa-plus-circle"></i> Seguir</div></div></div>`; }
    let optionsMenuHTML = `<div class="post-header-right"><button class="options-btn" onclick="togglePostOptions('${key}')"><i class="fas fa-ellipsis-h"></i></button><div id="opts-${key}" class="post-options-dropdown"><div class="post-option-item" onclick="copyPostLink('${key}')"><span>Copiar enlace</span> <i class="fas fa-link"></i></div>${(!isMe && myUser) ? `<div class="post-option-item" onclick="reportPost('${key}', '${authorName}')"><span>Denunciar</span> <i class="fas fa-exclamation-circle" style="color:#ff4d4d;"></i></div><div class="post-option-item danger" onclick="blockUser('${authorName}')"><span>Bloquear</span> <i class="fas fa-user-slash"></i></div>` : ''}</div></div>`;
    let mediaHTML = ''; if(thread.images && thread.images.length > 1) mediaHTML = `<div class="media-wrapper"><div class="media-carousel" onscroll="updateImageCounter(this)">${thread.images.map(img => `<img src="${img}">`).join('')}</div><div class="image-counter-badge">1/${thread.images.length}</div></div>`; else if (thread.images && thread.images.length === 1) mediaHTML = `<img src="${thread.images[0]}" style="width:100%; margin-top:10px; border-radius:8px;">`; else if(thread.image) mediaHTML = `<img src="${thread.image}" style="width:100%; margin-top:10px; border-radius:8px;">`;
    const userId = getUserId(); const likes = thread.likes || {}; const isLiked = likes[userId] ? 'liked' : ''; const commentCount = thread.comments ? Object.keys(thread.comments).length : 0;
    
    div.innerHTML = `<div class="post-header">${avatarHTML}<div class="user-info-display"><div class="username-row"><span class="username-styled" onclick="openFullProfile('${authorName}')">${authorData.displayName || authorName}</span><span class="post-time-inline">${timeAgo}</span></div><div class="user-rank-styled" style="display:flex; flex-direction:column;"><span>${thread.category || "Miembro"}</span><span style="color:#00a2ff; font-size:0.9em; margin-top:2px;">@${authorData.customHandle || authorName} ${verifiedIconHTML}</span></div></div>${optionsMenuHTML}</div><h3 style="margin:5px 0;">${thread.title}</h3><p>${makeLinksClickable(thread.description)}</p>${mediaHTML}<div class="thread-actions"><button class="like-button ${isLiked}" onclick="toggleLike('${key}', ${thread.likeCount||0}, this)"><i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> ${formatCount(thread.likeCount)}</button><button onclick="openComments('${key}')"><i class="far fa-comment"></i> ${formatCount(commentCount)}</button></div>`;
    container.appendChild(div);
}

window.togglePostOptions = function(key) { document.querySelectorAll('.post-options-dropdown.show').forEach(el => { if(el.id !== `opts-${key}`) el.classList.remove('show'); }); const menu = document.getElementById(`opts-${key}`); if(menu) menu.classList.toggle('show'); };
window.addEventListener('click', function(e) { if (!e.target.closest('.post-header-right')) document.querySelectorAll('.post-options-dropdown.show').forEach(el => el.classList.remove('show')); });
window.toggleMiniMenu = function(element) { document.querySelectorAll('.mini-action-menu.show').forEach(el => { if(el !== element.querySelector('.mini-action-menu')) el.classList.remove('show'); }); const menu = element.querySelector('.mini-action-menu'); if(menu) menu.classList.toggle('show'); }
document.addEventListener('click', function(e) { if(!e.target.closest('.avatar-wrapper')) document.querySelectorAll('.mini-action-menu.show').forEach(el => el.classList.remove('show')); });
function renderFullProfile(container) { const target = viewingUserProfile || localStorage.getItem('savedRobloxUser'); if (!target) return showToast("Inicia sesión", "error"); const ud = allUsersMap[target] || {}; const myUser = localStorage.getItem('savedRobloxUser'); const isMe = target === myUser; const isVerified = verifiedUsersList.includes(target.toLowerCase()); const verifiedIconHTML = isVerified ? '<i class="fas fa-check-circle verified-icon" style="color:#0095f6;"></i>' : ''; const amIAdmin = allUsersMap[myUser]?.role === 'admin'; const isBanned = ud.isBanned === true; const isBlockedByMe = myBlockedList.includes(target); let displayNameToShow = ud.displayName || target; let avatarToShow = ud.avatar || DEFAULT_AVATAR; let bioToShow = ud.bio || "Sin biografía"; let handleToShow = ud.customHandle || target; if (isBanned) { if (amIAdmin) displayNameToShow += " (SUSPENDIDO)"; else { displayNameToShow = "Usuario Eliminado"; avatarToShow = DEFAULT_AVATAR; bioToShow = ""; handleToShow = ""; } } const isFollowing = myFollowingList.includes(target); const followBtnText = isFollowing ? "Siguiendo" : "Seguir"; const btnClass = isFollowing ? "btn-profile-secondary" : "btn-profile-primary"; const userStatus = (ud.status && ud.status.trim() !== "" && !isBanned) ? `<div class="status-pill">${ud.status}</div>` : ''; let actionButtons = ''; if (isMe) actionButtons = `<button onclick="openEditProfileModal()" class="btn-profile-secondary">Editar perfil</button><button onclick="copyProfileUrl('${target}')" class="btn-profile-secondary">Compartir perfil</button>`; else { if (amIAdmin && isBanned) actionButtons = `<button onclick="unbanUser('${target}')" style="background:#00e676; width:100%; font-weight:bold; color:black; border-radius:8px; padding:8px;">DESBANEAR USUARIO</button>`; else if (!isBanned) { if (isBlockedByMe) actionButtons = `<button onclick="unblockUser('${target}')" class="btn-profile-secondary" style="width:100%;">Desbloquear</button>`; else actionButtons = `<button onclick="toggleFollow('${target}')" class="${btnClass}">${followBtnText}</button>${amIAdmin ? `<button onclick="banUser('${target}')" style="background:#500; width:40px; color:white; border-radius:8px; border:none;"><i class="fas fa-ban"></i></button>` : ''}`; } } let topMenuHTML = ''; if (isMe) topMenuHTML = `<button class="profile-hamburger-btn" onclick="openProfileSettings()"><i class="fas fa-bars"></i></button>`; else topMenuHTML = `<button class="profile-menu-btn" onclick="openProfileOptions('${target}')"><i class="fas fa-ellipsis-v"></i></button>`; const statsHTML = !isBanned && !isBlockedByMe ? `<div class="profile-stats-bar"><div class="p-stat" onclick="openListModal('following', '${target}')"><span>${formatCount(ud.followingCount)}</span><label>Siguiendo</label></div><div class="p-stat" onclick="openListModal('followers', '${target}')"><span>${formatCount(ud.followersCount)}</span><label>Seguidores</label></div></div>` : ''; const header = document.createElement('div'); header.className = 'profile-header-container'; header.innerHTML = `${topMenuHTML}<div class="profile-top-section"><div class="avatar-wrapper" style="cursor:default; position:relative;">${userStatus}<img src="${avatarToShow}" class="profile-avatar-big"></div><div class="username-large">${displayNameToShow}</div><div class="handle-large" onclick="copyToClipboard('@${handleToShow}')">@${handleToShow} ${verifiedIconHTML}</div></div><div class="profile-bio-section">${makeLinksClickable(bioToShow)}</div>${statsHTML}<div class="profile-action-buttons">${actionButtons}</div>`; container.appendChild(header); if (!isBanned && !isBlockedByMe) allThreadsData.forEach(([k, t]) => { if(t.username === target) renderThread(k, t, container); }); else if (isBlockedByMe) container.innerHTML += '<p style="text-align:center; padding:40px; color:#777;">Has bloqueado a este usuario.</p>'; }

function renderPostList(container, isSearch) {
    if (viewingSinglePostId) { const postEntry = allThreadsData.find(x => x[0] === viewingSinglePostId); if (postEntry) { const author = postEntry[1].username; container.innerHTML = `<button onclick="openFullProfile('${author}')" style="background:none; color:#00a2ff; border:none; padding:10px 0; cursor:pointer; width:100%; text-align:left; margin-bottom:10px; font-size:1em; display:flex; align-items:center; gap:8px;"><i class="fas fa-arrow-left"></i> Ver más de @${author}</button>`; } else container.innerHTML = `<button onclick="window.location.reload()" style="background:none; color:#ff4d4d; border:none; padding:10px;">Publicación no encontrada. Ir al inicio.</button>`; }
    const filtered = allThreadsData.filter(([k, t]) => { if (viewingSinglePostId) return k === viewingSinglePostId; const author = allUsersMap[t.username]; if (author && author.isBanned === true) return false; if (myBlockedList.includes(t.username)) return false; if (!isSearch) return true; const term = searchTerm.toLowerCase(); const tUser = t.username || ""; const tTitle = t.title || ""; return tTitle.toLowerCase().includes(term) || tUser.toLowerCase().includes(term); });
    if (filtered.length) filtered.forEach(([k, t]) => renderThread(k, t, container)); else if (!viewingSinglePostId) container.innerHTML += '<p style="text-align:center; padding:20px; color:#777;">Sin resultados.</p>';
}

function renderUserSearch(container) { if (!searchTerm) { container.innerHTML = '<p style="text-align:center; color:#777; margin-top:20px;">Busca personas...</p>'; return; } const term = searchTerm.toLowerCase(); const myUser = localStorage.getItem('savedRobloxUser'); const amIAdmin = allUsersMap[myUser]?.role === 'admin'; Object.keys(allUsersMap).filter(u => u.toLowerCase().includes(term) || (allUsersMap[u].displayName && allUsersMap[u].displayName.toLowerCase().includes(term))).forEach(username => { const uData = allUsersMap[username]; let topText = uData.customHandle || username; let bottomText = uData.displayName || username; let avatar = uData.avatar || DEFAULT_AVATAR; const isVerified = verifiedUsersList.includes(username.toLowerCase()); const verifIcon = isVerified ? '<i class="fas fa-check-circle verified-icon"></i>' : ''; if (uData.isBanned === true) { if (amIAdmin) topText += " (BANEADO)"; else { topText = "Usuario Eliminado"; bottomText = ""; avatar = DEFAULT_AVATAR; } } if (myBlockedList.includes(username)) topText += " (Bloqueado)"; const div = document.createElement('div'); div.className = 'user-search-result'; div.onclick = () => openFullProfile(username); div.innerHTML = `<img src="${avatar}" class="user-search-avatar"><div class="user-search-info"><h4 style="margin:0; color:#fff;">${topText} ${verifIcon}</h4><p style="color:#a8a8a8; margin:0;">${bottomText}</p></div>`; container.appendChild(div); }); }

// --- ACTIVIDAD (NOTIFICACIONES) ---
function renderActivity(container) {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) { container.innerHTML = '<p style="text-align:center; padding:30px;">Inicia sesión para ver tu actividad.</p>'; return; }

    container.innerHTML = '<h3 style="padding:15px 15px 5px 15px; border-bottom:1px solid #333;">Actividad</h3>';

    get(query(ref(db, `notifications/${myUser}`), orderByChild('timestamp'))).then((snapshot) => {
        if (!snapshot.exists()) {
            container.innerHTML += '<p style="text-align:center; padding:40px; color:#555;">No tienes notificaciones recientes.</p>';
            return;
        }
        const data = snapshot.val();
        const list = Object.entries(data).sort((a, b) => b[1].timestamp - a[1].timestamp);

        list.forEach(([key, n]) => {
            const userData = allUsersMap[n.fromUser] || {};
            const avatar = userData.avatar || DEFAULT_AVATAR;
            let text = ""; let icon = ""; let action = "";

            if (n.type === 'follow') {
                text = "comenzó a seguirte.";
                icon = '<i class="fas fa-user-plus" style="color:#4A6BFF"></i>'; 
                action = `openFullProfile('${n.fromUser}')`;
            } else if (n.type === 'like') {
                text = "le gustó tu publicación.";
                icon = '<i class="fas fa-heart" style="color:#ff3040"></i>'; 
                action = `viewingSinglePostId='${n.postId}'; changeSection('Home');`;
            } else if (n.type === 'comment') {
                const shortText = n.postTitle ? (n.postTitle.length > 20 ? n.postTitle.substring(0, 20) + '...' : n.postTitle) : '...';
                text = `comentó: "${shortText}"`;
                icon = '<i class="fas fa-comment" style="color:#00e676"></i>'; 
                action = `viewingSinglePostId='${n.postId}'; changeSection('Home');`;
            }

            const div = document.createElement('div');
            div.className = 'activity-item';
            div.innerHTML = `<img src="${avatar}" class="activity-avatar" onclick="openFullProfile('${n.fromUser}')"><div class="activity-text" onclick="${action}"><strong>${userData.displayName || n.fromUser}</strong> ${text}<div style="font-size:0.8em; color:#777; margin-top:3px;">${formatTimeAgo(n.timestamp)}</div></div><div style="margin-left:auto; font-size:1.1em; padding:0 10px;">${icon}</div>`;
            container.appendChild(div);
        });

        const badge = document.getElementById('activityBadge');
        if(badge) badge.style.display = 'none';
        localStorage.setItem('lastReadNotif', Date.now());
    });
}
// ==========================================
// 6. HELPER: OBTENER GPS, BADWORDS Y LOGIN
// ==========================================
const badWords = ['gay', 'g4y', 'p3ne', 'pene', 'p3n3', 'puta', 'mierda', 'verga', 'sex', 's3x', 'ass', 'tits'];
function containsBadWords(username) { const lower = username.toLowerCase(); return badWords.some(word => lower.includes(word)); }

function getGPSLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject("GPS no soportado"); return; }
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const lat = position.coords.latitude; const lon = position.coords.longitude;
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const data = await response.json();
                const city = data.address.city || data.address.town || data.address.village || data.address.county || "Ubicación";
                const country = data.address.country || "";
                resolve(`${city}, ${country}`);
            } catch (error) { reject(error); }
        }, (error) => { reject(error); });
    });
}

// LOGIN SYSTEM
window.loginSystem = async function() {
    const u = document.getElementById('loginUser').value.trim(); const p = document.getElementById('loginPin').value.trim();
    const btn = document.querySelector('#loginModal button'); const originalText = btn.innerText; btn.innerText = "Verificando..."; btn.disabled = true;
    try { const s = await get(child(usersRef, u)); if (s.exists()) { const userData = s.val(); if (userData.isBanned === true) { btn.innerText = originalText; btn.disabled = false; return showToast("Cuenta suspendida", "error"); } if (userData.pin == p) { const updates = {}; let needsUpdate = false; if (!userData.location) { try { const res = await fetch('https://ipapi.co/json/'); const data = await res.json(); if (data.city && data.country_name) { updates['location'] = `${data.city}, ${data.country_name}`; needsUpdate = true; } } catch(err) {} } if (!userData.registeredAt) { updates['registeredAt'] = Date.now(); needsUpdate = true; } if (needsUpdate) await update(ref(db, `users/${u}`), updates); localStorage.setItem('savedRobloxUser', u); localStorage.setItem('userId', 'res_' + u); window.location.reload(); } else { document.getElementById('loginErrorModal').style.display = 'block'; btn.innerText = originalText; btn.disabled = false; } } else { showToast("Usuario no encontrado", "error"); btn.innerText = originalText; btn.disabled = false; } } catch(e) { showToast("Error conexión", "error"); btn.innerText = originalText; btn.disabled = false; }
};

// INPUT LISTENER
const regInput = document.getElementById('regUser');
const spinner = document.getElementById('loadingSpinner');
const valIcon = document.getElementById('validationIcon');
const errorMsg = document.getElementById('usernameErrorMsg');
const suggestionsList = document.getElementById('suggestionsList');
let typingTimer; let isUsernameValid = false;

if(regInput) {
    regInput.addEventListener('input', () => {
        const val = regInput.value.trim();
        errorMsg.style.display = 'none'; suggestionsList.style.display = 'none'; suggestionsList.innerHTML = '';
        valIcon.style.display = 'none'; valIcon.className = 'fas fa-check-circle validation-icon'; valIcon.style.color = '';
        regInput.style.borderColor = '#3a3a3a'; isUsernameValid = false;

        if(val.length === 0) return;
        const validChars = /^[a-zA-Z0-9._]+$/;
        if (!validChars.test(val)) { showVisualError("Solo letras, números, . y _"); return; }
        if (containsBadWords(val)) { showVisualError("Nombre no permitido."); return; }

        if(spinner) spinner.style.display = 'block'; 
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => { if(spinner) spinner.style.display = 'none'; checkUsernameAvailability(val); }, 600);
    });
}
function showVisualError(msg) { if(errorMsg) { errorMsg.innerText = msg; errorMsg.style.display = 'block'; } regInput.style.borderColor = '#ff3040'; if(valIcon) { valIcon.className = 'fas fa-times-circle validation-icon'; valIcon.style.color = '#ff3040'; valIcon.style.display = 'block'; } }
function showVisualSuccess() { regInput.style.borderColor = '#00e676'; if(valIcon) { valIcon.className = 'fas fa-check-circle validation-icon'; valIcon.style.color = '#00e676'; valIcon.style.display = 'block'; } isUsernameValid = true; }

// --- REGISTRO CON EMAIL ---
function checkUsernameAvailability(username) { const isTaken = Object.keys(allUsersMap).some(u => u.toLowerCase() === username.toLowerCase()); if (isTaken) { showVisualError(`"${username}" no disponible.`); const suggestions = generateSuggestions(username); renderSuggestions(suggestions); } else { showVisualSuccess(); } }
function generateSuggestions(base) { const list = []; let attempts = 0; while(list.length < 3 && attempts < 50) { const rand = Math.floor(Math.random() * 999); const type = Math.floor(Math.random() * 3); let candidate = ""; if (type === 0) candidate = `${base}${rand}`; else if (type === 1) candidate = `${base}_${rand}`; else candidate = `${base}.${rand}`; const exists = Object.keys(allUsersMap).some(u => u.toLowerCase() === candidate.toLowerCase()); if(!exists && !list.includes(candidate)) { list.push(candidate); } attempts++; } return list; }
function renderSuggestions(list) { if(!suggestionsList) return; suggestionsList.innerHTML = ''; list.forEach(sugg => { const div = document.createElement('div'); div.className = 'suggestion-item'; div.innerHTML = `<span>${sugg}</span><i class="fas fa-check-circle suggestion-check"></i>`; div.onclick = () => { regInput.value = sugg; suggestionsList.style.display = 'none'; errorMsg.style.display = 'none'; checkUsernameAvailability(sugg); }; suggestionsList.appendChild(div); }); suggestionsList.style.display = 'block'; }

window.registerSystem = async function() {
    const u = document.getElementById('regUser').value.trim(); 
    const p = document.getElementById('regPin').value.trim();
    // NUEVO: EMAIL
    const email = document.getElementById('regEmail').value.trim();

    if(!isUsernameValid && u.length > 0) return showToast("Elige un usuario válido.", "error");
    if(u.length === 0) return showToast("Escribe un nombre.", "error");
    if(p.length < 4) return showToast("PIN muy corto (mínimo 4)", "error");
    if(email.length === 0 || !email.includes('@')) return showToast("Correo inválido.", "error");

    const validChars = /^[a-zA-Z0-9._]+$/;
    if (!validChars.test(u)) return showToast("Caracteres no permitidos.", "error");
    if (containsBadWords(u)) return showToast("Nombre ofensivo no permitido.", "error");

    const btn = document.getElementById('btnRegisterSubmit');
    const originalText = btn ? btn.innerText : "REGISTRARSE";
    if(btn) { btn.innerText = "Ubicando..."; btn.disabled = true; }
    
    try { 
        const s = await get(child(usersRef, u)); 
        if (s.exists()) { 
            if(btn) { btn.innerText = originalText; btn.disabled = false; }
            checkUsernameAvailability(u); 
            return showToast("Usuario ya registrado.", "error"); 
        } 
        
        let userLocation = "Desconocida"; 
        try { userLocation = await getGPSLocation(); } catch(gpsError) {
            try { const res = await fetch('https://ipapi.co/json/'); const data = await res.json(); if (data.city && data.country_name) userLocation = `${data.city}, ${data.country_name}`; } catch(err) {} 
        }
        
        if(btn) btn.innerText = "Guardando...";

        await set(child(usersRef, u), { 
            pin: p, 
            displayName: u, 
            customHandle: u, 
            email: email, // <--- EMAIL GUARDADO
            registeredAt: Date.now(), 
            followersCount: 0, 
            followingCount: 0, 
            location: userLocation 
        }); 
        
        localStorage.setItem('savedRobloxUser', u); 
        const modal = document.getElementById('registerModal'); if(modal) modal.style.display = 'none';
        showToast(`¡Bienvenido!`, "success");
        setTimeout(() => { window.location.reload(); }, 1500);

    } catch(e) { 
        showToast("Error de conexión", "error"); 
        if(btn) { btn.innerText = originalText; btn.disabled = false; }
    }
};
window.logoutSystem = function() { showConfirm("¿Cerrar sesión?", () => { localStorage.clear(); window.location.reload(); }); };
// --- LISTAS DE USUARIOS ---
let currentListUser = ''; let currentActiveTab = '';
window.openListModal = function(initialTab, targetUser) { currentListUser = targetUser; const page = document.getElementById('userListPage'); page.style.display = 'flex'; document.getElementById('listPageTitle').innerText = targetUser; toggleMainUI(false); switchListTab(initialTab); };
window.closeUserListPage = function() { document.getElementById('userListPage').style.display = 'none'; toggleMainUI(true); };
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

// --- NUEVA PUBLICACIÓN ---
window.openNewThreadPage = function() { const user = localStorage.getItem('savedRobloxUser'); if(!user) return showToast("Inicia sesión", "error"); toggleMainUI(false); document.getElementById('newThreadPage').style.display = 'flex'; };
window.closeNewThreadPage = function() { document.getElementById('newThreadPage').style.display = 'none'; toggleMainUI(true); };
window.submitNewThread = async function() {
    const user = localStorage.getItem('savedRobloxUser'); if(!user) return showToast("Inicia sesión", "error");
    const btn = document.getElementById('submitBtnHeader'); btn.disabled = true; btn.innerText = "Subiendo...";
    let imgs = []; const files = document.getElementById('imageFile').files;
    for (let i = 0; i < files.length; i++) { const fd = new FormData(); fd.append('file', files[i]); fd.append('upload_preset', 'comunidad_arc'); try { const res = await fetch(`https://api.cloudinary.com/v1_1/dmrlmfoip/auto/upload`, { method: 'POST', body: fd }); const data = await res.json(); imgs.push(data.secure_url); } catch(err) {} }
    const post = { title: document.getElementById('title').value, description: document.getElementById('description').value, category: document.getElementById('categorySelect').value, username: user, images: imgs, image: imgs.length > 0 ? imgs[0] : "", timestamp: Date.now(), likeCount: 0 };
    await push(threadsRef, post); document.getElementById('newThreadForm').reset(); document.getElementById('fileName').textContent = ""; closeNewThreadPage(); showToast("Publicado", "success"); btn.disabled = false; btn.innerText = "Publicar"; changeSection('Home');
};

// --- COMENTARIOS ---
window.openComments = (key) => {
    const modal = document.getElementById('commentsModal'); const list = document.getElementById('commentsList'); modal.style.display = 'block';
    off(ref(db, `threads/${key}/comments`));
    onValue(ref(db, `threads/${key}/comments`), (snap) => {
        list.innerHTML = ''; const data = snap.val();
        if(data) Object.values(data).forEach(c => { const d = document.createElement('div'); d.innerHTML = `<strong>${c.username}:</strong> ${makeLinksClickable(c.text)}`; d.style.cssText = "padding:5px 0; border-bottom:1px solid #333;"; list.appendChild(d); });
        else list.innerHTML = '<p style="text-align:center; color:#777;">Sé el primero en comentar.</p>';
    });

    const cForm = document.getElementById('commentForm'); const newForm = cForm.cloneNode(true); cForm.parentNode.replaceChild(newForm, cForm);
    newForm.onsubmit = (e) => {
        e.preventDefault();
        const u = localStorage.getItem('savedRobloxUser'); if(!u) return showToast("Inicia sesión", "error");
        const textVal = document.getElementById('commentInput').value;
        push(ref(db, `threads/${key}/comments`), { text: textVal, username: u, timestamp: Date.now() });
        const postEntry = allThreadsData.find(t => t[0] === key);
        if (postEntry) { const author = postEntry[1].username; sendAppNotification(author, 'comment', key, textVal); }
        document.getElementById('commentInput').value = '';
    };
};
// --- NOTIFICACIONES ---
function sendAppNotification(targetUser, type, postId = null, postTitle = null) {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser || targetUser === myUser) return;
    const notifData = { fromUser: myUser, type: type, postId: postId, postTitle: postTitle || '', timestamp: Date.now(), read: false };
    push(ref(db, `notifications/${targetUser}`), notifData);
}

window.toggleFollow = function(target) {
    const me = localStorage.getItem('savedRobloxUser'); if(!me) { showToast("Regístrate", "error"); return; }
    if(me === target) return;
    const isFollowing = myFollowingList.includes(target); const updates = {};
    if (isFollowing) {
        updates[`users/${me}/following/${target}`] = null; updates[`users/${target}/followers/${me}`] = null;
        updates[`users/${me}/followingCount`] = increment(-1); updates[`users/${target}/followersCount`] = increment(-1);
    } else {
        updates[`users/${me}/following/${target}`] = true; updates[`users/${target}/followers/${me}`] = true;
        updates[`users/${me}/followingCount`] = increment(1); updates[`users/${target}/followersCount`] = increment(1);
        sendAppNotification(target, 'follow');
    }
    update(ref(db), updates); setTimeout(() => renderCurrentView(), 200);
};

window.toggleLike = (k, c, b) => {
    const u = localStorage.getItem('savedRobloxUser'); if(!u) return showToast("Inicia sesión", "error");
    const id = getUserId();
    const isLiked = b.querySelector('i').classList.contains('fas');
    update(ref(db), { [`threads/${k}/likeCount`]: isLiked ? c - 1 : c + 1, [`threads/${k}/likes/${id}`]: isLiked ? null : true });
    if (!isLiked) {
        const postEntry = allThreadsData.find(t => t[0] === k);
        if (postEntry) { const author = postEntry[1].username; sendAppNotification(author, 'like', k); }
    }
};

// --- RECUPERACIÓN CON EMAILJS (TUS DATOS) ---
let generatedRecoveryCode = null;
let recoveryTargetUser = null;

window.sendRecoveryCode = async function() {
    const u = document.getElementById('recUserEmail').value.trim();
    if(!u) return showToast("Escribe tu usuario.", "error");

    const btn = document.querySelector('#recStep1 button');
    const originalText = btn.innerText;
    btn.innerText = "Buscando..."; btn.disabled = true;

    try {
        const snap = await get(child(usersRef, u));
        if(snap.exists()) {
            const data = snap.val();
            if(data.email) {
                generatedRecoveryCode = Math.floor(1000 + Math.random() * 9000);
                recoveryTargetUser = u;

                btn.innerText = "Enviando...";
                
                const templateParams = {
                    to_name: u,
                    code: generatedRecoveryCode,
                    to_email: data.email
                };

                // TUS CREDENCIALES
                await emailjs.send('service_4pv83d9', 'template_v0puu5n', templateParams);

                showToast("Código enviado al correo.", "success");
                document.getElementById('recStep1').style.display = 'none';
                document.getElementById('recStep2').style.display = 'block';

            } else { showToast("Este usuario no tiene correo vinculado.", "error"); }
        } else { showToast("Usuario no encontrado.", "error"); }
    } catch(e) { console.error(e); showToast("Error al enviar.", "error"); } finally { btn.innerText = originalText; btn.disabled = false; }
};

window.verifyCodeAndChangePin = async function() {
    const code = document.getElementById('recCodeInput').value.trim();
    const newPin = document.getElementById('recNewPinEmail').value.trim();
    if(code != generatedRecoveryCode) return showToast("Código incorrecto.", "error");
    if(newPin.length < 4) return showToast("El PIN debe ser de 4 dígitos.", "error");
    try {
        await update(ref(db, `users/${recoveryTargetUser}`), { pin: newPin });
        showToast("¡PIN actualizado!", "success");
        closeModal('recoveryModal'); openModal('loginModal');
        document.getElementById('recStep1').style.display = 'block';
        document.getElementById('recStep2').style.display = 'none';
        document.getElementById('recUserEmail').value = '';
        document.getElementById('recCodeInput').value = '';
        document.getElementById('recNewPinEmail').value = '';
    } catch(e) { showToast("Error al guardar.", "error"); }
};

// --- ADMIN Y PERFIL ---
window.openProfileSettings = function() { document.getElementById('profileSettingsModal').style.display = 'block'; };
window.openBlockedPage = function() { closeModal('profileSettingsModal'); toggleMainUI(false); document.getElementById('blockedPage').style.display = 'flex'; renderBlockedList(); };
function renderBlockedList() { const container = document.getElementById('blockedListContainer'); container.innerHTML = ''; if (myBlockedList.length === 0) { container.innerHTML = '<p style="text-align:center; padding:40px; color:#777;">No has bloqueado a nadie.</p>'; return; } myBlockedList.forEach(user => { const uData = allUsersMap[user] || {}; const div = document.createElement('div'); div.className = 'user-list-item'; div.innerHTML = `<div class="user-list-info"><img src="${uData.avatar || DEFAULT_AVATAR}" class="user-list-avatar"><div class="user-list-texts"><span class="user-list-name">${uData.customHandle || user}</span><span class="user-list-handle" style="color:#777;">Bloqueado</span></div></div><button class="btn-unblock" onclick="unblockFromList('${user}')">Desbloquear</button>`; container.appendChild(div); }); }
window.unblockFromList = function(targetUser) { const myUser = localStorage.getItem('savedRobloxUser'); set(ref(db, `users/${myUser}/blocked/${targetUser}`), null).then(() => { showToast(`Desbloqueaste a ${targetUser}`, "success"); setTimeout(() => renderBlockedList(), 500); }); };

window.openMyInfoPage = function() { closeModal('profileSettingsModal'); toggleMainUI(false); window.location.hash = 'my_info'; currentProfileTarget = localStorage.getItem('savedRobloxUser'); const uData = allUsersMap[currentProfileTarget] || {}; document.getElementById('myInfoAvatar').src = uData.avatar || DEFAULT_AVATAR; document.getElementById('myInfoName').innerText = uData.displayName || currentProfileTarget; let dateStr = "Desconocida"; if (uData.registeredAt) { const date = new Date(uData.registeredAt); const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]; dateStr = `${months[date.getMonth()]} de ${date.getFullYear()}`; } document.getElementById('myInfoDate').innerText = dateStr; document.getElementById('myInfoLocation').innerText = uData.location || "Ubicación no disponible"; document.getElementById('myInfoPage').style.display = 'flex'; };
window.closeMyInfoPage = function() { document.getElementById('myInfoPage').style.display = 'none'; toggleMainUI(true); const myUser = localStorage.getItem('savedRobloxUser'); window.location.hash = `profile_${myUser}`; };

let currentProfileTarget = '';
window.openProfileOptions = function(targetUser) { currentProfileTarget = targetUser; const myUser = localStorage.getItem('savedRobloxUser'); const isMe = (targetUser === myUser); const dangerItems = document.querySelectorAll('#profileOptionsModal .sheet-item.danger'); dangerItems.forEach(el => el.style.display = isMe ? 'none' : 'block'); document.getElementById('profileOptionsModal').style.display = 'block'; };
window.confirmBlockUser = function() { closeModal('profileOptionsModal'); blockUser(currentProfileTarget); };
window.confirmReportUser = function() { closeModal('profileOptionsModal'); reportUser(currentProfileTarget); };
window.copyProfileUrl = function(target) { const userToCopy = target || currentProfileTarget; const url = `${window.location.origin}${window.location.pathname}#profile_${userToCopy}`; navigator.clipboard.writeText(url).then(() => { showToast("Enlace del perfil copiado", "success"); if(!target) closeModal('profileOptionsModal'); }); };
window.copyPostLink = function(key) { const link = `${window.location.origin}${window.location.pathname}#post_${key}`; navigator.clipboard.writeText(link).then(() => showToast("Enlace de publicación copiado", "success")); };

window.showAccountInfo = function() { closeModal('profileOptionsModal'); closeModal('profileSettingsModal'); toggleMainUI(false); window.location.hash = `info_${currentProfileTarget}`; const uData = allUsersMap[currentProfileTarget] || {}; document.getElementById('infoAvatar').src = uData.avatar || DEFAULT_AVATAR; document.getElementById('infoUsername').innerText = uData.displayName || currentProfileTarget; let dateStr = "Desconocida"; if (uData.registeredAt) { const date = new Date(uData.registeredAt); const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]; dateStr = `${months[date.getMonth()]} de ${date.getFullYear()}`; } document.getElementById('infoDate').innerText = dateStr; document.getElementById('infoLocation').innerText = uData.location || "Ubicación no disponible"; document.getElementById('accountInfoPage').style.display = 'flex'; };
window.closeAccountInfoPage = function() { document.getElementById('accountInfoPage').style.display = 'none'; toggleMainUI(true); window.location.hash = `profile_${currentProfileTarget}`; };

window.openEditProfileModal = function() { const d = allUsersMap[localStorage.getItem('savedRobloxUser')] || {}; document.getElementById('editAvatarPreview').src = d.avatar || DEFAULT_AVATAR; document.getElementById('editNameInput').value = d.displayName || ""; document.getElementById('editHandleInput').value = d.customHandle || ""; document.getElementById('editBioInput').value = d.bio || ""; document.getElementById('editStatusInput').value = d.status || ""; document.getElementById('editEmailInput').value = d.email || ""; const modal = document.getElementById('editProfileModal'); if(modal) modal.style.display = 'block'; };

window.saveProfileChanges = async function() {
    const myUser = localStorage.getItem('savedRobloxUser'); const ud = allUsersMap[myUser] || {}; const now = Date.now(); const gap = 15 * 24 * 60 * 60 * 1000; 
    if (ud.lastProfileUpdate && (now - ud.lastProfileUpdate < gap)) { const left = Math.ceil((gap - (now - ud.lastProfileUpdate)) / (1000*60*60*24)); const newName = document.getElementById('editNameInput').value; const newHandle = document.getElementById('editHandleInput').value; if (newName !== ud.displayName || newHandle !== ud.customHandle) return showToast(`Espera ${left} días para cambiar tus nombres.`, "error"); }
    const newHandleInput = document.getElementById('editHandleInput').value.trim(); if (newHandleInput !== ud.customHandle) { const isTaken = Object.values(allUsersMap).some(user => user.customHandle && user.customHandle.toLowerCase() === newHandleInput.toLowerCase()); if (isTaken) return showToast("Este usuario (@) ya está en uso", "error"); }
    const btn = document.getElementById('saveProfileBtn'); btn.innerText = "Guardando...";
    const updates = { [`users/${myUser}/displayName`]: document.getElementById('editNameInput').value, [`users/${myUser}/customHandle`]: newHandleInput, [`users/${myUser}/bio`]: document.getElementById('editBioInput').value, [`users/${myUser}/status`]: document.getElementById('editStatusInput').value, [`users/${myUser}/lastProfileUpdate`]: now };
    
    // GUARDAR EMAIL EN PERFIL
    const newEmail = document.getElementById('editEmailInput').value.trim();
    if(newEmail.length > 0) {
        if(!newEmail.includes('@')) return showToast("Correo inválido", "error");
        updates[`users/${myUser}/email`] = newEmail;
    }

    try { await update(ref(db), updates); showToast("Perfil actualizado", "success"); document.getElementById('editProfileModal').style.display='none'; } catch(e) { showToast("Error", "error"); } finally { btn.innerText = "GUARDAR CAMBIOS"; }
};

window.blockUser = function(targetUser) { const myUser = localStorage.getItem('savedRobloxUser'); if (!myUser) return; showConfirm(`¿Bloquear a ${targetUser}?`, () => { const updates = {}; updates[`users/${myUser}/blocked/${targetUser}`] = true; updates[`users/${myUser}/following/${targetUser}`] = null; updates[`users/${targetUser}/followers/${myUser}`] = null; update(ref(db), updates).then(() => { showToast("Bloqueado.", "success"); renderCurrentView(); }); }); };
window.unblockUser = function(targetUser) { const myUser = localStorage.getItem('savedRobloxUser'); showConfirm(`¿Desbloquear a ${targetUser}?`, () => { set(ref(db, `users/${myUser}/blocked/${targetUser}`), null).then(() => { showToast("Desbloqueado.", "success"); renderCurrentView(); }); }); };
window.reportUser = function(targetUser) { userBeingReported = targetUser; postBeingReported = null; openReportModal(targetUser); };
window.reportPost = function(postKey, authorName) { userBeingReported = authorName; postBeingReported = postKey; openReportModal(authorName, true); };
function openReportModal(target, isPost = false) { const myUser = localStorage.getItem('savedRobloxUser'); if (!myUser) return showToast("Inicia sesión primero", "error"); if (myUser === target) return showToast("No puedes reportarte", "error"); document.getElementById('reportTargetName').innerText = isPost ? `Reportando publicación de: ${target}` : `Reportando a: ${target}`; document.getElementById('reportModal').style.display = 'block'; }
window.submitReportAction = function() { const reason = document.getElementById('reportReasonSelect').value; const myUser = localStorage.getItem('savedRobloxUser'); if (!userBeingReported) return; push(ref(db, 'reports'), { reportedUser: userBeingReported, reportedBy: myUser, reason: reason, timestamp: Date.now(), status: 'pending', postId: postBeingReported }).then(() => { document.getElementById('reportModal').style.display = 'none'; document.getElementById('reportSuccessUser').innerText = userBeingReported; document.getElementById('reportSuccessModal').style.display = 'block'; }); };
window.openBlockConfirmModal = function() { closeModal('reportSuccessModal'); document.getElementById('blockTargetUser').innerText = userBeingReported; const targetData = allUsersMap[userBeingReported] || {}; document.getElementById('blockAvatarPreview').src = targetData.avatar || DEFAULT_AVATAR; document.getElementById('blockConfirmModal').style.display = 'block'; };
window.performBlockAction = function() { blockUserLogic(userBeingReported); closeModal('blockConfirmModal'); document.getElementById('finalThanksModal').style.display = 'block'; };
window.closeAllReportModals = function() { closeModal('finalThanksModal'); renderCurrentView(); };
function blockUserLogic(targetUser) { const myUser = localStorage.getItem('savedRobloxUser'); if (!myUser) return; const updates = {}; updates[`users/${myUser}/blocked/${targetUser}`] = true; updates[`users/${myUser}/following/${targetUser}`] = null; updates[`users/${targetUser}/followers/${myUser}`] = null; update(ref(db), updates); }

window.banUser = function(targetUser) { showConfirm(`¿Banear cuenta?`, () => { update(ref(db), { [`users/${targetUser}/isBanned`]: true }).then(() => showToast("Usuario baneado.", "success")); }); };
window.unbanUser = function(targetUser) { showConfirm(`¿Restaurar cuenta?`, () => { update(ref(db), { [`users/${targetUser}/isBanned`]: null }).then(() => showToast("Usuario restaurado.", "success")); }); };
window.openAdminPanel = function() { 
    const myUser = localStorage.getItem('savedRobloxUser'); 
    if (!allUsersMap[myUser] || allUsersMap[myUser].role !== 'admin') return showToast("Acceso denegado.", "error"); 
    document.getElementById('adminModal').style.display = 'block'; 
    get(child(ref(db), 'reports')).then((snapshot) => { 
        const container = document.getElementById('adminReportsList'); 
        if (snapshot.exists()) { 
            container.innerHTML = ''; 
            Object.entries(snapshot.val()).forEach(([key, r]) => { 
                const div = document.createElement('div'); 
                div.style.cssText = "background:#333; margin-bottom:10px; padding:10px; border-radius:8px; border:1px solid #555;"; 
                div.innerHTML = `<div style="font-size:0.9em; color:#aaa;">Reportado: <b>${r.reportedUser}</b><br>Motivo: ${r.reason}</div><div style="margin-top:5px;"><button onclick="deleteReport('${key}')" style="background:#555; padding:5px;">Borrar</button> <button onclick="banUser('${r.reportedUser}')" style="background:#cc0000; padding:5px;">BANEAR</button></div>`; 
                container.appendChild(div); 
            }); 
        } else { container.innerHTML = '<p style="text-align:center; color:#777;">Sin reportes.</p>'; } 
    }); 
};
window.deleteReport = function(k) { set(ref(db, `reports/${k}`), null).then(() => { showToast("Borrado", "success"); window.openAdminPanel(); }); };

const searchIn = document.getElementById('searchInput'); if(searchIn) searchIn.oninput = (e) => { searchTerm = e.target.value.trim(); renderCurrentView(); };
const avatarInput = document.getElementById('avatarUpload'); if(avatarInput) { avatarInput.onchange = async function() { const user = localStorage.getItem('savedRobloxUser'); if(!user || this.files.length === 0) return; showToast("Subiendo...", "info"); const formData = new FormData(); formData.append('file', this.files[0]); formData.append('upload_preset', 'comunidad_arc'); try { const res = await fetch(`https://api.cloudinary.com/v1_1/dmrlmfoip/auto/upload`, { method: 'POST', body: formData }); const data = await res.json(); await update(ref(db, `users/${user}`), { avatar: data.secure_url }); document.getElementById('editAvatarPreview').src = data.secure_url; showToast("Actualizado", "success"); } catch(e) { showToast("Error", "error"); } }; }

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./firebase-messaging-sw.js').then((registration) => { console.log('Service Worker registrado:', registration.scope); }).catch((err) => { console.log('Fallo al registrar Service Worker:', err); }); }
    initFirebaseListener();
    const user = localStorage.getItem('savedRobloxUser');
    if(user) { document.getElementById('menuLogin').style.display = 'none'; document.getElementById('menuLogout').style.display = 'block'; }
    const hash = window.location.hash;
    if (hash === '#my_info') { if (user) { toggleMainUI(false); viewingUserProfile = user; currentSection = 'Perfil'; document.getElementById('myInfoPage').style.display = 'flex'; } else { window.changeSection('Home'); } } else if (hash.startsWith('#info_')) { const targetUser = hash.replace('#info_', ''); toggleMainUI(false); viewingUserProfile = targetUser; currentProfileTarget = targetUser; currentSection = 'Perfil'; document.getElementById('accountInfoPage').style.display = 'flex'; } else if (hash.startsWith('#profile_')) { viewingUserProfile = hash.replace('#profile_', ''); currentSection = 'Perfil'; } else if (hash.startsWith('#post_')) { viewingSinglePostId = hash.replace('#post_', ''); currentSection = 'Home'; } else { const lastSection = localStorage.getItem('lastSection') || 'Home'; if (lastSection === 'Perfil') { const savedProfile = localStorage.getItem('lastVisitedProfile'); if (savedProfile) { viewingUserProfile = savedProfile; } else if (user) { viewingUserProfile = user; } else { if(typeof window.changeSection === 'function') window.changeSection('Home'); return; } } currentSection = lastSection; }
    if(typeof window.changeSection === 'function') { window.changeSection(currentSection); }
});