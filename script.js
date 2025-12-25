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

let searchTerm = ''; 
let currentSection = 'Home'; 
let viewingUserProfile = ''; 
let allThreadsData = []; 
let verifiedUsersList = []; 
let allUsersMap = {}; 
let myFollowingList = []; 
let myBlockedList = []; 
let userBeingReported = ''; 
let postBeingReported = null;
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
        showToast("Usuario copiado", "success");
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

// --- ACTUALIZADO: LÓGICA DE FECHAS (7 DÍAS / AÑO) ---
function formatTimeAgo(timestamp) {
    if (!timestamp) return "";
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000); 

    // Menos de 1 minuto
    if (diff < 60) return "hace un momento";
    
    // Menos de 1 hora
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes} min`;
    
    // Menos de 24 horas
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    
    // Menos de 7 días
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} d`;
    
    // Más de 7 días: Formato de fecha
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const currentYear = new Date().getFullYear();

    if (year === currentYear) {
        return `${day}/${month}`; // Ej: 12/12
    } else {
        return `${day}/${month}/${year}`; // Ej: 12/12/2025
    }
}

window.getUserId = function() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
}

function initFirebaseListener() {
    onValue(usersRef, (snap) => { 
        allUsersMap = snap.val() || {}; 
        const myUser = localStorage.getItem('savedRobloxUser');
        
        if (myUser && allUsersMap[myUser] && allUsersMap[myUser].isBanned === true) {
            showToast("tu cuenta ha sido suspendida", "error");
            localStorage.clear();
            setTimeout(() => { window.location.reload(); }, 3000);
            return;
        }

        const btnAdmin = document.getElementById('btnAdminPanel');
        if(btnAdmin) {
            if(myUser && allUsersMap[myUser] && allUsersMap[myUser].role === 'admin') {
                btnAdmin.style.display = 'block';
            } else { btnAdmin.style.display = 'none'; }
        }

        if (myUser && allUsersMap[myUser]) {
            myFollowingList = allUsersMap[myUser].following ? Object.keys(allUsersMap[myUser].following) : [];
            myBlockedList = allUsersMap[myUser].blocked ? Object.keys(allUsersMap[myUser].blocked) : [];
        } else {
            myFollowingList = [];
            myBlockedList = [];
        }
        if (allThreadsData.length > 0) renderCurrentView(); 
    });
    
    onValue(query(threadsRef, orderByChild('timestamp')), (snap) => {
        const data = snap.val();
        allThreadsData = data ? Object.entries(data).sort((a,b) => b[1].timestamp - a[1].timestamp) : [];
        renderCurrentView();
    });
    
    onValue(verifiedRef, (snap) => {
        const data = snap.val();
        verifiedUsersList = data ? Object.keys(data).map(n => n.toLowerCase()) : [];
        renderCurrentView();
    });
}
window.changeSection = function(sectionName) {
    currentSection = sectionName;
    localStorage.setItem('lastSection', sectionName);
    
    if(sectionName !== 'Perfil') {
        localStorage.removeItem('lastVisitedProfile');
        viewingUserProfile = ''; 
    }
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const sc = document.getElementById('searchContainer');
    
    if(sectionName === 'Busqueda') {
        document.getElementById('nav-search').classList.add('active');
        if(sc) sc.style.display = 'block';
    } else {
        if(sc) sc.style.display = 'none';
        const map = { Home: 'nav-home', Activity: 'nav-activity', Perfil: 'nav-profile' };
        if(map[sectionName]) document.getElementById(map[sectionName]).classList.add('active');
    }
    renderCurrentView();
    if(sectionName === 'Home') window.scrollTo(0,0);
};

window.openMyProfile = function() {
    viewingUserProfile = ''; 
    localStorage.removeItem('lastVisitedProfile'); 
    changeSection('Perfil'); 
};

window.openFullProfile = (u) => { 
    viewingUserProfile = u; 
    localStorage.setItem('lastVisitedProfile', u); 
    changeSection('Perfil'); 
};

function renderCurrentView() {
    const container = document.querySelector('.thread-container');
    if(!container) return;
    container.innerHTML = '';

    if (currentSection === 'Activity') return renderActivity(container);
    if (currentSection === 'Perfil') return renderFullProfile(container);
    if (currentSection === 'Busqueda') {
        renderUserSearch(container);
        if (searchTerm) renderPostList(container, true);
        return;
    }
    renderPostList(container, false);
}
window.updateImageCounter = function(carousel) {
    const width = carousel.offsetWidth;
    const currentIndex = Math.round(carousel.scrollLeft / width) + 1;
    const totalImages = carousel.childElementCount;
    const badge = carousel.parentElement.querySelector('.image-counter-badge');
    if(badge) badge.innerText = `${currentIndex}/${totalImages}`;
};

function renderThread(key, thread, container) {
    const div = document.createElement('div');
    div.className = 'thread';
    
    const authorName = thread.username || "Desconocido";
    const authorData = allUsersMap[authorName] || {};
    const myUser = localStorage.getItem('savedRobloxUser');
    const isVerified = authorName && verifiedUsersList.includes(authorName.toLowerCase());
    const verifiedIconHTML = isVerified ? '<i class="fas fa-check-circle verified-icon"></i>' : '';
    
    const isMe = (myUser === authorName);
    const isFollowing = myFollowingList.includes(authorName);
    const timeAgo = formatTimeAgo(thread.timestamp);
    
    let avatarHTML = `<img src="${authorData.avatar || DEFAULT_AVATAR}" class="user-avatar-small" onclick="openFullProfile('${authorName}')">`;
    if (!isMe && myUser && !isFollowing) {
        avatarHTML = `
        <div class="avatar-wrapper" onclick="toggleMiniMenu(this)">
            <img src="${authorData.avatar || DEFAULT_AVATAR}" class="user-avatar-small">
            <div class="plus-badge"><i class="fas fa-plus"></i></div>
            <div class="mini-action-menu">
                <div onclick="event.stopPropagation(); openFullProfile('${authorName}')"><i class="far fa-user"></i> Perfil</div>
                <div onclick="event.stopPropagation(); toggleFollow('${authorName}');"><i class="fas fa-plus-circle"></i> Seguir</div>
            </div>
        </div>`;
    }

    let optionsMenuHTML = '';
    if (!isMe && myUser) {
        optionsMenuHTML = `
        <div class="post-header-right">
            <button class="options-btn" onclick="togglePostOptions('${key}')"><i class="fas fa-ellipsis-h"></i></button>
            <div id="opts-${key}" class="post-options-dropdown">
                <div class="post-option-item" onclick="copyPostLink('${key}')">
                    <span>Copiar enlace</span> <i class="fas fa-link"></i>
                </div>
                <div class="post-option-item" onclick="reportPost('${key}', '${authorName}')">
                    <span>Denunciar</span> <i class="fas fa-exclamation-circle" style="color:#ff4d4d;"></i>
                </div>
                <div class="post-option-item danger" onclick="blockUser('${authorName}')">
                    <span>Bloquear</span> <i class="fas fa-user-slash"></i>
                </div>
            </div>
        </div>`;
    } else {
        optionsMenuHTML = `<div class="post-header-right"></div>`; 
    }

    let mediaHTML = '';
    if(thread.images && thread.images.length > 1) {
        mediaHTML = `<div class="media-wrapper"><div class="media-carousel" onscroll="updateImageCounter(this)">${thread.images.map(img => `<img src="${img}">`).join('')}</div><div class="image-counter-badge">1/${thread.images.length}</div></div>`;
    } else if (thread.images && thread.images.length === 1) {
        mediaHTML = `<img src="${thread.images[0]}" style="width:100%; margin-top:10px; border-radius:8px;">`;
    } else if(thread.image) {
        mediaHTML = `<img src="${thread.image}" style="width:100%; margin-top:10px; border-radius:8px;">`;
    }

    const userId = getUserId();
    const likes = thread.likes || {};
    const isLiked = likes[userId] ? 'liked' : '';
    const commentCount = thread.comments ? Object.keys(thread.comments).length : 0;

    div.innerHTML = `
        <div class="post-header">
            ${avatarHTML}
            <div class="user-info-display">
                <div class="username-row">
                    <span class="username-styled" onclick="openFullProfile('${authorName}')">
                        ${authorData.displayName || authorName}
                    </span>
                    <span class="post-time-inline">${timeAgo}</span>
                </div>
                <div class="user-rank-styled" style="display:flex; flex-direction:column;">
                    <span>${thread.category || "Miembro"}</span>
                    <span style="color:#00a2ff; font-size:0.9em; margin-top:2px;">
                        @${authorData.customHandle || authorName} ${verifiedIconHTML}
                    </span>
                </div>
            </div>
            ${optionsMenuHTML}
        </div>
        <h3 style="margin:5px 0;">${thread.title}</h3>
        <p>${makeLinksClickable(thread.description)}</p>
        ${mediaHTML}
        <div class="thread-actions">
            <button class="like-button ${isLiked}" onclick="toggleLike('${key}', ${thread.likeCount||0}, this)">
                <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> ${formatCount(thread.likeCount)}
            </button>
            <button onclick="openComments('${key}')">
                <i class="far fa-comment"></i> ${formatCount(commentCount)}
            </button>
        </div>
    `;
    container.appendChild(div);
}

window.togglePostOptions = function(key) {
    document.querySelectorAll('.post-options-dropdown.show').forEach(el => {
        if(el.id !== `opts-${key}`) el.classList.remove('show');
    });
    const menu = document.getElementById(`opts-${key}`);
    if(menu) menu.classList.toggle('show');
};

window.addEventListener('click', function(e) {
    if (!e.target.closest('.post-header-right')) {
        document.querySelectorAll('.post-options-dropdown.show').forEach(el => el.classList.remove('show'));
    }
});

window.copyPostLink = function(key) {
    const link = `${window.location.origin}/#post_${key}`;
    navigator.clipboard.writeText(link).then(() => showToast("Enlace copiado", "success"));
};
window.toggleMiniMenu = function(element) {
    document.querySelectorAll('.mini-action-menu.show').forEach(el => {
        if(el !== element.querySelector('.mini-action-menu')) el.classList.remove('show');
    });
    const menu = element.querySelector('.mini-action-menu');
    if(menu) menu.classList.toggle('show');
}
document.addEventListener('click', function(e) {
    if(!e.target.closest('.avatar-wrapper')) {
        document.querySelectorAll('.mini-action-menu.show').forEach(el => el.classList.remove('show'));
    }
});

function renderFullProfile(container) {
    const target = viewingUserProfile || localStorage.getItem('savedRobloxUser');
    if (!target) return showToast("Inicia sesión", "error");
    
    const ud = allUsersMap[target] || {};
    const myUser = localStorage.getItem('savedRobloxUser');
    const isMe = target === myUser;
    const isVerified = verifiedUsersList.includes(target.toLowerCase());
    const verifiedIconHTML = isVerified ? '<i class="fas fa-check-circle verified-icon" style="color:#0095f6;"></i>' : '';
    const amIAdmin = allUsersMap[myUser]?.role === 'admin';
    const isBanned = ud.isBanned === true;
    const isBlockedByMe = myBlockedList.includes(target);

    let displayNameToShow = ud.displayName || target;
    let avatarToShow = ud.avatar || DEFAULT_AVATAR;
    let bioToShow = ud.bio || "Sin biografía";
    let handleToShow = ud.customHandle || target;

    if (isBanned) {
        if (amIAdmin) displayNameToShow += " (SUSPENDIDO)";
        else { 
            displayNameToShow = "Usuario Eliminado"; 
            avatarToShow = DEFAULT_AVATAR; 
            bioToShow = ""; 
            handleToShow = "";
        }
    }

    const isFollowing = myFollowingList.includes(target);
    const followBtnText = isFollowing ? "Siguiendo" : "Seguir";
    const btnClass = isFollowing ? "background-color: #333; color: white;" : "background-color: white; color: black;"; 
    
    const userStatus = (ud.status && ud.status.trim() !== "" && !isBanned) ? `<div class="status-pill">${ud.status}</div>` : '';
    
    let actionButtons = '';
    if (isMe) {
        actionButtons = `<button onclick="openEditProfileModal()" style="background-color: #333; color: white; border: 1px solid #444;">Editar perfil</button>`;
    } else {
        if (amIAdmin && isBanned) {
            actionButtons = `<button onclick="unbanUser('${target}')" style="background:#00e676; width:100%; font-weight:bold; color:black;">DESBANEAR USUARIO</button>`;
        } else if (!isBanned) {
            if (isBlockedByMe) {
                actionButtons = `<button onclick="unblockUser('${target}')" style="background:#333; width:100%; color:white;">Desbloquear</button>`;
            } else {
                actionButtons = `
                    <div style="display:flex; gap:8px; justify-content:center; width:100%;">
                        <button onclick="toggleFollow('${target}')" style="${btnClass} flex:1;">${followBtnText}</button>
                        <button onclick="reportUser('${target}')" style="background:#333; width:40px; color:white; display:flex; justify-content:center; align-items:center; padding:0;" title="Reportar"><i class="fas fa-exclamation-triangle"></i></button>
                        <button onclick="blockUser('${target}')" style="background:#333; width:40px; color:#ff4d4d; display:flex; justify-content:center; align-items:center; padding:0;" title="Bloquear"><i class="fas fa-user-slash"></i></button>
                        ${amIAdmin ? `<button onclick="banUser('${target}')" style="background:#500; width:40px; color:white; display:flex; justify-content:center; align-items:center; padding:0;" title="BANEAR"><i class="fas fa-ban"></i></button>` : ''}
                    </div>
                `;
            }
        }
    }
    
    const statsHTML = !isBanned && !isBlockedByMe ? `
        <div class="profile-stats-bar">
            <div class="p-stat" onclick="openListModal('following', '${target}')">
                <span>${formatCount(ud.followingCount)}</span><label>Siguiendo</label>
            </div>
            <div class="p-stat" onclick="openListModal('followers', '${target}')">
                <span>${formatCount(ud.followersCount)}</span><label>Seguidores</label>
            </div>
        </div>` : '';

    const header = document.createElement('div');
    header.className = 'profile-header-container';
    
    header.innerHTML = `
        <div class="profile-top-section">
            <div class="avatar-wrapper" style="cursor:default; position:relative;">
                ${userStatus}
                <img src="${avatarToShow}" class="profile-avatar-big">
            </div>
            <div class="username-large">${displayNameToShow}</div>
            <div class="handle-large" onclick="copyToClipboard('@${handleToShow}')">@${handleToShow} ${verifiedIconHTML}</div>
        </div>
        <div class="profile-bio-section">${makeLinksClickable(bioToShow)}</div>
        ${statsHTML}
        <div class="profile-action-buttons">${actionButtons}</div>
    `;
    container.appendChild(header);

    if (!isBanned && !isBlockedByMe) {
        allThreadsData.forEach(([k, t]) => { if(t.username === target) renderThread(k, t, container); });
    } else if (isBlockedByMe) {
        container.innerHTML += '<p style="text-align:center; padding:40px; color:#777;">Has bloqueado a este usuario.</p>';
    }
}
function renderPostList(container, isSearch) {
    const filtered = allThreadsData.filter(([k, t]) => {
        const author = allUsersMap[t.username];
        if (author && author.isBanned === true) return false; 
        if (myBlockedList.includes(t.username)) return false;

        if (!isSearch) return true;
        const term = searchTerm.toLowerCase();
        const tUser = t.username || ""; 
        const tTitle = t.title || "";
        return tTitle.toLowerCase().includes(term) || tUser.toLowerCase().includes(term);
    });
    if (filtered.length) filtered.forEach(([k, t]) => renderThread(k, t, container));
    else container.innerHTML += '<p style="text-align:center; padding:20px; color:#777;">Sin resultados.</p>';
}

function renderUserSearch(container) {
    if (!searchTerm) { container.innerHTML = '<p style="text-align:center; color:#777; margin-top:20px;">Busca personas...</p>'; return; }
    const term = searchTerm.toLowerCase();
    
    const myUser = localStorage.getItem('savedRobloxUser');
    const amIAdmin = allUsersMap[myUser]?.role === 'admin';

    Object.keys(allUsersMap).filter(u => 
        u.toLowerCase().includes(term) || 
        (allUsersMap[u].displayName && allUsersMap[u].displayName.toLowerCase().includes(term))
    ).forEach(username => {
        const uData = allUsersMap[username];
        
        let topText = uData.customHandle || username; 
        let bottomText = uData.displayName || username; 
        
        let avatar = uData.avatar || DEFAULT_AVATAR;
        const isVerified = verifiedUsersList.includes(username.toLowerCase());
        const verifIcon = isVerified ? '<i class="fas fa-check-circle verified-icon"></i>' : '';

        if (uData.isBanned === true) {
            if (amIAdmin) topText += " (BANEADO)";
            else { topText = "Usuario Eliminado"; bottomText = ""; avatar = DEFAULT_AVATAR; }
        }
        if (myBlockedList.includes(username)) topText += " (Bloqueado)";

        const div = document.createElement('div');
        div.className = 'user-search-result';
        div.onclick = () => openFullProfile(username);
        div.innerHTML = `
            <img src="${avatar}" class="user-search-avatar">
            <div class="user-search-info">
                <h4 style="margin:0; color:#fff;">${topText} ${verifIcon}</h4>
                <p style="color:#a8a8a8; margin:0;">${bottomText}</p>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderActivity(container) {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) { container.innerHTML = '<p style="text-align:center; padding:30px;">Inicia sesión.</p>'; return; }
    container.innerHTML = '<h3 style="padding:15px; border-bottom:1px solid #333;">Actividad</h3>';
    const myData = allUsersMap[myUser];
    if (myData?.followers) {
        Object.keys(myData.followers).forEach(f => {
            const fd = allUsersMap[f] || {};
            const div = document.createElement('div');
            div.className = 'activity-item';
            div.innerHTML = `<img src="${fd.avatar || DEFAULT_AVATAR}" class="activity-avatar"> <div class="activity-text"><strong>${f}</strong> te siguió.</div>`;
            container.appendChild(div);
        });
    } else { container.innerHTML += '<p style="text-align:center; padding:40px; color:#555;">Sin actividad.</p>'; }
}
// --- SISTEMA DE LISTAS ---
let currentListUser = '';
let currentActiveTab = '';

window.openListModal = function(initialTab, targetUser) {
    currentListUser = targetUser;
    document.getElementById('userListModal').style.display = 'block';
    switchListTab(initialTab);
};

window.switchListTab = function(tabName) {
    currentActiveTab = tabName;
    const myUser = localStorage.getItem('savedRobloxUser');
    const targetData = allUsersMap[currentListUser] || {};

    document.getElementById('tab-followers').classList.remove('active');
    document.getElementById('tab-following').classList.remove('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');

    document.getElementById('count-followers').innerText = formatCount(targetData.followersCount);
    document.getElementById('count-following').innerText = formatCount(targetData.followingCount);

    const container = document.getElementById('userListContainer');
    container.innerHTML = ''; 

    if (tabName === 'followers' && targetData.privateFollowers === true && currentListUser !== myUser) {
        container.innerHTML = '<p style="text-align:center; padding:30px; color:#777;">La lista de seguidores de este perfil es privada.</p>';
        return;
    }

    const listObj = tabName === 'followers' ? targetData.followers : targetData.following;
    const listArray = listObj ? Object.keys(listObj) : [];
    
    window.currentRenderedList = listArray;
    document.getElementById('userListSearch').value = ""; 
    
    renderUserListInModal(listArray);
};

function renderUserListInModal(userArray) {
    const container = document.getElementById('userListContainer');
    container.innerHTML = '';
    
    if (userArray.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#555;">Lista vacía.</p>';
        return;
    }

    userArray.forEach(username => {
        const uData = allUsersMap[username] || {};
        const isVerified = verifiedUsersList.includes(username.toLowerCase());
        const verifIcon = isVerified ? '<i class="fas fa-check-circle verified-icon"></i>' : '';
        const iAmFollowing = myFollowingList.includes(username);
        const isMe = username === localStorage.getItem('savedRobloxUser');
        
        let btnHTML = '';
        if (!isMe) {
            if (iAmFollowing) btnHTML = `<button class="btn-small-follow btn-state-following" onclick="toggleFollowFromList('${username}')">Siguiendo</button>`;
            else btnHTML = `<button class="btn-small-follow btn-state-follow" onclick="toggleFollowFromList('${username}')">Seguir</button>`;
        }

        const div = document.createElement('div');
        div.className = 'user-list-item';
        div.innerHTML = `
            <div class="user-list-info" onclick="openFullProfile('${username}'); document.getElementById('userListModal').style.display='none'">
                <img src="${uData.avatar || DEFAULT_AVATAR}" class="user-list-avatar">
                <div class="user-list-texts">
                    <span class="user-list-name">${uData.customHandle || username} ${verifIcon}</span>
                    <span class="user-list-handle">${uData.displayName || username}</span>
                </div>
            </div>
            ${btnHTML}
        `;
        container.appendChild(div);
    });
}
// --- SWIPE LOGIC ---
let touchStartX = 0;
let touchEndX = 0;

const listModal = document.getElementById('userListModal'); 
listModal.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; });
listModal.addEventListener('touchend', e => { 
    touchEndX = e.changedTouches[0].screenX;
    if (touchEndX < touchStartX - 50 && currentActiveTab === 'followers') switchListTab('following');
    if (touchEndX > touchStartX + 50 && currentActiveTab === 'following') switchListTab('followers');
});

// --- BUSCADOR Y FOLLOW ---
window.toggleFollowFromList = function(target) {
    window.toggleFollow(target);
    setTimeout(() => {
        const term = document.getElementById('userListSearch').value.toLowerCase();
        const filtered = window.currentRenderedList.filter(u => u.toLowerCase().includes(term));
        renderUserListInModal(filtered);
    }, 200); 
};

document.getElementById('userListSearch').oninput = function(e) {
    const term = e.target.value.toLowerCase();
    const filtered = window.currentRenderedList.filter(u => {
        const ud = allUsersMap[u] || {};
        const dName = ud.displayName || "";
        return u.toLowerCase().includes(term) || dName.toLowerCase().includes(term);
    });
    renderUserListInModal(filtered);
};

// --- RESTO DE FUNCIONES ---
window.openEditProfileModal = function() {
    const d = allUsersMap[localStorage.getItem('savedRobloxUser')] || {};
    document.getElementById('editAvatarPreview').src = d.avatar || DEFAULT_AVATAR;
    document.getElementById('editNameInput').value = d.displayName || "";
    document.getElementById('editHandleInput').value = d.customHandle || "";
    document.getElementById('editBioInput').value = d.bio || "";
    document.getElementById('editStatusInput').value = d.status || "";
    const modal = document.getElementById('editProfileModal') || document.getElementById('editModal');
    if(modal) modal.style.display = 'block';
};

window.saveProfileChanges = async function() {
    const myUser = localStorage.getItem('savedRobloxUser');
    const ud = allUsersMap[myUser] || {};
    const now = Date.now();
    const gap = 15 * 24 * 60 * 60 * 1000; 
    if (ud.lastProfileUpdate && (now - ud.lastProfileUpdate < gap)) {
        const left = Math.ceil((gap - (now - ud.lastProfileUpdate)) / (1000*60*60*24));
        const newName = document.getElementById('editNameInput').value;
        const newHandle = document.getElementById('editHandleInput').value;
        if (newName !== ud.displayName || newHandle !== ud.customHandle) {
            return showToast(`Espera ${left} días para cambiar tus nombres.`, "error");
        }
    }
    const btn = document.getElementById('saveProfileBtn');
    btn.innerText = "Guardando...";
    const updates = {
        [`users/${myUser}/displayName`]: document.getElementById('editNameInput').value,
        [`users/${myUser}/customHandle`]: document.getElementById('editHandleInput').value,
        [`users/${myUser}/bio`]: document.getElementById('editBioInput').value,
        [`users/${myUser}/status`]: document.getElementById('editStatusInput').value,
        [`users/${myUser}/lastProfileUpdate`]: now
    };
    try { await update(ref(db), updates); showToast("Perfil actualizado", "success"); document.getElementById('editProfileModal').style.display='none'; } 
    catch(e) { showToast("Error", "error"); }
    finally { btn.innerText = "GUARDAR CAMBIOS"; }
};

window.blockUser = function(targetUser) {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) return;
    showConfirm(`¿Bloquear a ${targetUser}?`, () => {
        const updates = {};
        updates[`users/${myUser}/blocked/${targetUser}`] = true;
        updates[`users/${myUser}/following/${targetUser}`] = null;
        updates[`users/${targetUser}/followers/${myUser}`] = null;
        update(ref(db), updates).then(() => { showToast("Bloqueado.", "success"); renderCurrentView(); });
    });
};

window.unblockUser = function(targetUser) {
    const myUser = localStorage.getItem('savedRobloxUser');
    showConfirm(`¿Desbloquear a ${targetUser}?`, () => {
        set(ref(db, `users/${myUser}/blocked/${targetUser}`), null).then(() => { showToast("Desbloqueado.", "success"); renderCurrentView(); });
    });
};

window.reportUser = function(targetUser) {
    userBeingReported = targetUser;
    postBeingReported = null; 
    openReportModal(targetUser);
};

window.reportPost = function(postKey, authorName) {
    userBeingReported = authorName;
    postBeingReported = postKey; 
    openReportModal(authorName, true);
};

function openReportModal(target, isPost = false) {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) return showToast("Inicia sesión primero", "error");
    if (myUser === target) return showToast("No puedes reportarte", "error");
    const nameLabel = document.getElementById('reportTargetName');
    if(nameLabel) nameLabel.innerText = isPost ? `Reportando publicación de: ${target}` : `Reportando a: ${target}`;
    document.getElementById('reportModal').style.display = 'block';
}

window.submitReportAction = function() {
    const reason = document.getElementById('reportReasonSelect').value;
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!userBeingReported) return;
    const reportData = { reportedUser: userBeingReported, reportedBy: myUser, reason: reason, timestamp: Date.now(), status: 'pending', postId: postBeingReported };
    push(ref(db, 'reports'), reportData).then(() => { showToast("Reporte enviado.", "success"); document.getElementById('reportModal').style.display = 'none'; userBeingReported = ''; postBeingReported = null; }).catch(() => showToast("Error", "error"));
};

window.banUser = function(targetUser) {
    showConfirm(`¿Esta seguro que quiere banear esta cuenta?`, () => {
        update(ref(db), { [`users/${targetUser}/isBanned`]: true })
            .then(() => showToast(`${targetUser} ha sido baneado.`, "success"))
            .catch(e => showToast("Error al banear", "error"));
    });
};

window.unbanUser = function(targetUser) {
    showConfirm(`¿Restaurar acceso a ${targetUser}?`, () => {
        update(ref(db), { [`users/${targetUser}/isBanned`]: null })
            .then(() => showToast(`${targetUser} restaurado.`, "success"))
            .catch(e => showToast("Error", "error"));
    });
};

window.openAdminPanel = function() {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!allUsersMap[myUser] || allUsersMap[myUser].role !== 'admin') return showToast("Acceso denegado.", "error");
    const modal = document.getElementById('adminModal');
    const container = document.getElementById('adminReportsList');
    if(modal) modal.style.display = 'block';
    
    get(child(ref(db), 'reports')).then((snapshot) => {
        if (snapshot.exists()) {
            const reports = snapshot.val();
            container.innerHTML = ''; 
            Object.entries(reports).forEach(([key, r]) => {
                const date = new Date(r.timestamp).toLocaleDateString();
                const typeLabel = r.postId ? '<span style="background:#00a2ff; padding:2px 5px; border-radius:4px; font-size:0.8em; color:white;">POST</span>' : '<span style="background:#555; padding:2px 5px; border-radius:4px; font-size:0.8em; color:white;">USUARIO</span>';
                const deletePostBtn = r.postId ? `<button onclick="deletePostFromPanel('${r.postId}', '${key}')" style="background:#ff9800; font-size:0.8em;">BORRAR POST</button>` : '';
                const div = document.createElement('div');
                div.style.cssText = "background:#333; margin-bottom:10px; padding:10px; border-radius:8px; border:1px solid #555;";
                div.innerHTML = `
                    <div style="font-size:0.9em; color:#aaa; margin-bottom:5px;">${date} | ${typeLabel} | De: <strong>${r.reportedBy}</strong></div>
                    <div style="color:white; font-weight:bold;">Reportado: <span style="color:#ff4d4d;">${r.reportedUser}</span></div>
                    <div style="background:#222; padding:5px; border-radius:4px; font-size:0.9em; margin:5px 0;">Motivo: ${r.reason}</div>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">
                        <button onclick="deleteReport('${key}')" style="background:#555; font-size:0.8em;">Descartar</button>
                        ${deletePostBtn}
                        <button onclick="banUserFromPanel('${r.reportedUser}', '${key}')" style="background:#cc0000; font-size:0.8em;">BANEAR</button>
                    </div>
                `;
                container.appendChild(div);
            });
        } else { container.innerHTML = '<p style="text-align:center; padding:20px; color:#777;">Sin reportes.</p>'; }
    });
};

window.deleteReport = function(k) { set(ref(db, `reports/${k}`), null).then(() => { showToast("Reporte borrado", "success"); openAdminPanel(); }); };
window.banUserFromPanel = function(u, k) { window.banUser(u); set(ref(db, `reports/${k}`), null); setTimeout(() => openAdminPanel(), 1000); };
window.deletePostFromPanel = function(pid, rid) { showConfirm("¿Eliminar publicación?", () => { set(ref(db, `threads/${pid}`), null); set(ref(db, `reports/${rid}`), null); showToast("Eliminado", "success"); setTimeout(() => openAdminPanel(), 1000); }); };

window.toggleFollow = function(target) {
    const me = localStorage.getItem('savedRobloxUser');
    if(!me) { showToast("Regístrate primero", "error"); return; }
    if(me === target) return;
    const isFollowing = myFollowingList.includes(target);
    const updates = {};
    const myFollowingCount = allUsersMap[me]?.followingCount || 0;
    const targetFollowersCount = allUsersMap[target]?.followersCount || 0;

    if (isFollowing) {
        updates[`users/${me}/following/${target}`] = null; 
        updates[`users/${target}/followers/${me}`] = null;
        updates[`users/${me}/followingCount`] = (myFollowingCount > 0) ? increment(-1) : 0;
        updates[`users/${target}/followersCount`] = (targetFollowersCount > 0) ? increment(-1) : 0;
        showToast(`Dejaste de seguir a ${target}`, "info");
    } else {
        updates[`users/${me}/following/${target}`] = true; 
        updates[`users/${target}/followers/${me}`] = true;
        updates[`users/${me}/followingCount`] = increment(1);
        updates[`users/${target}/followersCount`] = increment(1);
        showToast(`Siguiendo a ${target}`, "success");
    }
    update(ref(db), updates);
    setTimeout(() => renderCurrentView(), 200);
};

window.loginSystem = async function() {
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPin').value.trim();
    try {
        const s = await get(child(usersRef, u));
        if (s.exists()) {
            const userData = s.val();
            if (userData.isBanned === true) { return showToast("tu cuenta ha sido suspendida", "error"); }
            if (userData.pin == p) {
                localStorage.setItem('savedRobloxUser', u);
                localStorage.setItem('userId', 'res_' + u);
                window.location.reload();
            } else showToast("Datos incorrectos", "error");
        } else showToast("Datos incorrectos", "error");
    } catch(e) { showToast("Error de red", "error"); }
};

window.registerSystem = async function() {
    const u = document.getElementById('regUser').value.trim();
    const p = document.getElementById('regPin').value.trim();
    if(p.length < 4) return showToast("PIN muy corto", "error");
    try {
        const s = await get(child(usersRef, u));
        if (s.exists()) return showToast("Ya existe", "error");
        await set(child(usersRef, u), { pin: p, displayName: u, customHandle: u, registeredAt: Date.now(), followersCount: 0, followingCount: 0 });
        localStorage.setItem('savedRobloxUser', u);
        window.location.reload();
    } catch(e) { showToast("Error al registrar", "error"); }
};

window.logoutSystem = () => showConfirm("¿Cerrar sesión?", () => { 
    localStorage.clear(); 
    window.location.reload(); 
});

const searchIn = document.getElementById('searchInput');
if(searchIn) searchIn.oninput = (e) => { searchTerm = e.target.value.trim(); renderCurrentView(); };
window.toggleLike = (k, c, b) => {
    const u = localStorage.getItem('savedRobloxUser');
    if(!u) return showToast("Inicia sesión", "error");
    const id = getUserId();
    const isL = b.querySelector('i').classList.contains('fas');
    update(ref(db), { [`threads/${k}/likeCount`]: isL ? c - 1 : c + 1, [`threads/${k}/likes/${id}`]: isL ? null : true });
};
const avatarInput = document.getElementById('avatarUpload');
if(avatarInput) {
    avatarInput.onchange = async function() {
        const user = localStorage.getItem('savedRobloxUser');
        if(!user || this.files.length === 0) return;
        showToast("Subiendo avatar...", "info");
        const formData = new FormData();
        formData.append('file', this.files[0]);
        formData.append('upload_preset', 'comunidad_arc');
        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/dmrlmfoip/auto/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            await update(ref(db, `users/${user}`), { avatar: data.secure_url });
            document.getElementById('editAvatarPreview').src = data.secure_url;
            showToast("Avatar actualizado", "success");
        } catch(e) { showToast("Error", "error"); }
    };
}

window.openComments = (key) => {
    const modal = document.getElementById('commentsModal');
    const list = document.getElementById('commentsList');
    modal.style.display = 'block';
    off(ref(db, `threads/${key}/comments`));
    onValue(ref(db, `threads/${key}/comments`), (snap) => {
        list.innerHTML = '';
        const data = snap.val();
        if(data) Object.values(data).forEach(c => {
            const user = allUsersMap[c.username] || {};
            const isBanned = user.isBanned === true;
            const displayName = isBanned ? "Usuario Eliminado" : c.username;
            const textContent = makeLinksClickable(c.text);
            const d = document.createElement('div');
            d.innerHTML = `<strong>${displayName}:</strong> ${textContent}`;
            d.style.padding = "5px 0"; d.style.borderBottom = "1px solid #333";
            if(isBanned) d.style.color = "#777";
            list.appendChild(d);
        });
        else list.innerHTML = '<p style="text-align:center; color:#777;">Sin comentarios.</p>';
    });
    const cForm = document.getElementById('commentForm');
    const newForm = cForm.cloneNode(true);
    cForm.parentNode.replaceChild(newForm, cForm);
    newForm.onsubmit = (e) => {
        e.preventDefault();
        const u = localStorage.getItem('savedRobloxUser');
        if(!u) return showToast("Inicia sesión", "error");
        push(ref(db, `threads/${key}/comments`), { text: document.getElementById('commentInput').value, username: u, timestamp: Date.now() });
        document.getElementById('commentInput').value = '';
    };
};

const form = document.getElementById('newThreadForm');
if(form) {
    form.onsubmit = async (e) => {
        e.preventDefault();
        const user = localStorage.getItem('savedRobloxUser');
        if(!user) return showToast("Inicia sesión", "error");
        const btn = document.getElementById('submitBtn');
        btn.disabled = true; btn.innerText = "Subiendo...";
        let imgs = [];
        const files = document.getElementById('imageFile').files;
        for (let i = 0; i < files.length; i++) {
            const fd = new FormData();
            fd.append('file', files[i]);
            fd.append('upload_preset', 'comunidad_arc');
            try {
                const res = await fetch(`https://api.cloudinary.com/v1_1/dmrlmfoip/auto/upload`, { method: 'POST', body: fd });
                const data = await res.json();
                imgs.push(data.secure_url);
            } catch(err) { console.error(err); }
        }
        const post = { title: document.getElementById('title').value, description: document.getElementById('description').value, category: document.getElementById('categorySelect').value, username: user, images: imgs, image: imgs.length > 0 ? imgs[0] : "", timestamp: Date.now(), displayDate: new Date().toLocaleDateString('es-ES'), likeCount: 0 };
        await push(threadsRef, post);
        form.reset();
        document.getElementById('fileName').textContent = "";
        closeModal('newThreadModalContent');
        showToast("Publicado", "success");
        btn.disabled = false; btn.innerText = "PUBLICAR";
        changeSection('Home');
    };
}
document.addEventListener('DOMContentLoaded', () => {
    initFirebaseListener();
    const user = localStorage.getItem('savedRobloxUser');
    if(user) { 
        document.getElementById('menuLogin').style.display = 'none'; 
        document.getElementById('menuLogout').style.display = 'block'; 
    }
    const lastSection = localStorage.getItem('lastSection') || 'Home';
    if (lastSection === 'Perfil') {
        const savedProfile = localStorage.getItem('lastVisitedProfile');
        if (savedProfile) { viewingUserProfile = savedProfile; } 
        else {
            if (user) viewingUserProfile = ''; 
            else { 
                if(typeof window.changeSection === 'function') window.changeSection('Home');
                return;
            }
        }
    }
    if(typeof window.changeSection === 'function') {
        window.changeSection(lastSection);
    }
});