 // ============================================================
// SHARED.JS - Restauration Les Bouleaux
// Configuration Supabase + utilitaires partagés
// ============================================================

// ===== CONFIGURATION SUPABASE =====
const SUPABASE_URL = 'https://pdrwhlbhfychkbedkhcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-BKpAY6DCKAdRZ2ieVoHPA_ITXzptqf';
const supaClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== NOMS DES TABLES =====
const TABLE_RESIDENTS = 'résidents';
const TABLE_PRESENCES = 'presences';
const TABLE_PROFILS = 'profils_utilisateurs';
const TABLE_COMMANDES_EJC = 'commandes_ejc';
const TABLE_ANNULATIONS_EJC = 'annulations_ejc';

// ============================================================
// UTILITAIRES DATES
// ============================================================

function aujourdhui() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function dateFr(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate + 'T00:00:00');
    const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
}

function libelleRepas(code) {
    const map = {
        'petit_dej': '🥐 Petit-déjeuner',
        'dejeuner': '🍽️ Déjeuner',
        'diner': '🌙 Dîner'
    };
    return map[code] || code;
}

// ============================================================
// SEMAINE EJC (lundi, jours ouvrés, verrouillage)
// ============================================================

// Retourne le lundi (au format ISO YYYY-MM-DD) de la semaine d'une date donnée
function lundiDeLaSemaine(date) {
    const d = new Date(date);
    const jour = d.getDay(); // 0 = dimanche, 1 = lundi, ...
    const diff = jour === 0 ? -6 : 1 - jour;
    d.setDate(d.getDate() + diff);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Renvoie la liste des 5 jours ouvrés (lundi à vendredi) à partir d'un lundi
function joursOuvres(lundiIso) {
    const result = [];
    const d = new Date(lundiIso + 'T00:00:00');
    for (let i = 0; i < 5; i++) {
        const dd = new Date(d);
        dd.setDate(d.getDate() + i);
        const yyyy = dd.getFullYear();
        const mm = String(dd.getMonth() + 1).padStart(2, '0');
        const day = String(dd.getDate()).padStart(2, '0');
        result.push(`${yyyy}-${mm}-${day}`);
    }
    return result;
}

// Indique si la commande est encore ouverte pour une semaine donnée (lundi ISO)
// Règle : ouverte jusqu'au mardi 12h00 de la semaine S-1
function commandeOuverte(lundiSemaineConcernee) {
    const lundi = new Date(lundiSemaineConcernee + 'T00:00:00');
    // Mardi de la semaine précédente à 12h00
    const limite = new Date(lundi);
    limite.setDate(lundi.getDate() - 6); // mardi S-1
    limite.setHours(12, 0, 0, 0);
    return new Date() < limite;
}

// Indique si l'annulation est encore possible pour une date donnée
// Règle : possible jusqu'au jour J à 08h00
function annulationOuverte(dateIso) {
    const d = new Date(dateIso + 'T08:00:00');
    return new Date() < d;
}

// ============================================================
// AUTH - Vérification connexion + rôle
// ============================================================

async function verifierAuthEtRole(rolesAutorises) {
    // Vérifier la session
    const { data: { session } } = await supaClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }

    // Récupérer le profil
    const { data: profil, error } = await supaClient
        .from(TABLE_PROFILS)
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

    if (error || !profil) {
        alert('Profil utilisateur introuvable. Contactez l\'administrateur.');
        await supaClient.auth.signOut();
        window.location.href = 'login.html';
        return null;
    }

    // Vérifier le rôle
    if (rolesAutorises && rolesAutorises.length && !rolesAutorises.includes(profil.role)) {
        alert('⛔ Vous n\'avez pas accès à cette page.');
        // Rediriger selon le rôle
        if (profil.role === 'admin') window.location.href = 'residents.html';
        else if (profil.role === 'client_ejc') window.location.href = 'commande-ejc.html';
        else window.location.href = 'login.html';
        return null;
    }

    return { user: session.user, profil };
}

async function deconnexion() {
    await supaClient.auth.signOut();
    window.location.href = 'login.html';
}

// ============================================================
// PROFIL UTILISATEUR (utilisé par login.html)
// ============================================================

async function chargerProfil(userId) {
    const { data, error } = await supaClient
        .from(TABLE_PROFILS)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        console.error('Erreur chargement profil :', error);
        return null;
    }
    return data;
}

// ============================================================
// MENU & ENTÊTE
// ============================================================

function genererMenuOnglets(pageActive, role) {
    const ongletsAdmin = [
        { id: 'residents', titre: '👥 Résidents', url: 'residents.html' },
        { id: 'presences', titre: '✅ Présences', url: 'presences.html' },
        { id: 'production', titre: '📋 Production J-1', url: 'production.html' },
        { id: 'service', titre: '🍽️ Service du jour', url: 'service.html' },
        { id: 'recap-ejc', titre: '🍴 EJC Péry', url: 'recap-ejc.html' },
        { id: 'stats', titre: '📊 Statistiques', url: 'stats.html' }
    ];

    const ongletsEjc = [
        { id: 'commande-ejc', titre: '🍽️ Saisie repas EJC Péry', url: 'commande-ejc.html' }
    ];

    const onglets = role === 'client_ejc' ? ongletsEjc : ongletsAdmin;

    let html = '<div class="menu-onglets">';
    for (const o of onglets) {
        const cls = o.id === pageActive ? 'active' : '';
        html += `<a href="${o.url}" class="onglet ${cls}">${o.titre}</a>`;
    }
    html += '</div>';
    return html;
}

function afficherMenu(pageActive) {
    const menu = document.getElementById('menu');
    if (menu) menu.innerHTML = genererMenuOnglets(pageActive, 'admin');
}

function afficherMenuComplet(pageActive, emailUtilisateur, role, nomAffiche) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    let html = genererMenuOnglets(pageActive, role);
    html += `<div class="user-bar">
        <span>Connecté : <strong>${nomAffiche || emailUtilisateur}</strong></span>
        <button class="btn-danger btn-small" onclick="deconnexion()">🚪 Déconnexion</button>
    </div>`;
    menu.innerHTML = html;
}

// ============================================================
// RÉSIDENTS - Chargement
// ============================================================

async function chargerResidentsActifs() {
    const { data, error } = await supaClient
        .from(TABLE_RESIDENTS)
        .select('*')
        .eq('actif', true)
        .order('prenom', { ascending: true });
    if (error) {
        console.error('Erreur chargement résidents :', error);
        return [];
    }
    return data || [];
}