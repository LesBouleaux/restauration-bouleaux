 // ===== CONFIGURATION SUPABASE PARTAGÉE =====
const SUPABASE_URL = 'https://pdrwhlbhfychkbedkhcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-BKpAY6DCKAdRZ2ieVoHPA_ITXzptqf';
const supaClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== TABLES =====
const TABLE_RESIDENTS = 'résidents';
const TABLE_PRESENCES = 'presences';
const TABLE_PROFILS = 'profils_utilisateurs';
const TABLE_COMMANDES_EJC = 'commandes_ejc';
const TABLE_ANNULATIONS_EJC = 'annulations_ejc';

// ===== UTILITAIRES DATE =====

function dateISO(date) {
    const d = date instanceof Date ? date : new Date(date);
    const annee = d.getFullYear();
    const mois = String(d.getMonth() + 1).padStart(2, '0');
    const jour = String(d.getDate()).padStart(2, '0');
    return `${annee}-${mois}-${jour}`;
}

function aujourdhui() {
    return dateISO(new Date());
}

function demain() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return dateISO(d);
}

function dateFr(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
}

function libelleRepas(code) {
    const libelles = {
        'petit_dej': '🥐 Petit-déjeuner',
        'dejeuner': '🍽️ Déjeuner',
        'diner': '🌙 Dîner'
    };
    return libelles[code] || code;
}

// ===== UTILITAIRES SEMAINE EJC =====

function lundiDeLaSemaine(date) {
    const d = new Date(date);
    const jour = d.getDay();
    const diff = (jour === 0 ? -6 : 1 - jour);
    d.setDate(d.getDate() + diff);
    return d;
}

function joursOuvresSemaine(lundi) {
    const jours = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(lundi);
        d.setDate(d.getDate() + i);
        jours.push(dateISO(d));
    }
    return jours;
}

function commandeOuverte(lundiSemaine) {
    const maintenant = new Date();
    const lundi = new Date(lundiSemaine);
    const limite = new Date(lundi);
    limite.setDate(limite.getDate() - 6);
    limite.setHours(12, 0, 0, 0);
    return maintenant < limite;
}

function annulationOuverte(dateRepas) {
    const maintenant = new Date();
    const limite = new Date(dateRepas + 'T08:00:00');
    return maintenant < limite;
}

// ===== DONNÉES =====

async function chargerResidentsActifs() {
    const { data, error } = await supaClient
        .from(TABLE_RESIDENTS)
        .select('*')
        .eq('actif', true)
        .order('nom');
    if (error) {
        console.error('Erreur chargement résidents:', error);
        return [];
    }
    return data || [];
}

async function chargerProfil() {
    const { data: sessionData } = await supaClient.auth.getSession();
    if (!sessionData.session) return null;

    const { data, error } = await supaClient
        .from(TABLE_PROFILS)
        .select('*')
        .eq('user_id', sessionData.session.user.id)
        .single();
    if (error) {
        console.error('Erreur chargement profil:', error);
        return null;
    }
    return data;
}

// ===== MENU =====

function genererMenuOnglets(pageActive, role) {
    let onglets;
    if (role === 'client_ejc') {
        onglets = [
            { id: 'commande_ejc', fichier: 'commande-ejc.html', label: '🍴 Saisie repas EJC Péry' }
        ];
    } else {
        onglets = [
            { id: 'residents',   fichier: 'residents.html',  label: '👥 Résidents' },
            { id: 'presences',   fichier: 'presences.html',  label: '📋 Présences' },
            { id: 'production',  fichier: 'production.html', label: '📄 Production J-1' },
            { id: 'service',     fichier: 'service.html',    label: '🍽️ Service du jour' },
            { id: 'recap_ejc',   fichier: 'recap-ejc.html',  label: '🍴 EJC Péry' }
        ];
    }
    let html = '<nav class="tabs">';
    for (const o of onglets) {
        const cls = (o.id === pageActive) ? 'tab active' : 'tab';
        html += `<a href="${o.fichier}" class="${cls}">${o.label}</a>`;
    }
    html += '</nav>';
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
    const affichage = nomAffiche || emailUtilisateur;
    html += `<div style="text-align: right; margin: -10px 0 15px; font-size: 14px; color: #666;">
        Connecté : <strong>${affichage}</strong>
        &nbsp;<button class="btn-secondary" style="padding: 4px 10px; font-size: 13px;" onclick="seDeconnecter()">🚪 Déconnexion</button>
    </div>`;
    menu.innerHTML = html;
}

// ===== AUTHENTIFICATION + RÔLES =====

async function verifierAuthEtRole(rolesAutorises) {
    const { data: sessionData } = await supaClient.auth.getSession();
    if (!sessionData.session) {
        window.location.href = 'login.html';
        return null;
    }
    const profil = await chargerProfil();
    if (!profil) {
        alert('Profil introuvable. Contactez l\'administrateur.');
        await supaClient.auth.signOut();
        window.location.href = 'login.html';
        return null;
    }
    if (rolesAutorises && !rolesAutorises.includes(profil.role)) {
        if (profil.role === 'client_ejc') {
            window.location.href = 'commande-ejc.html';
        } else {
            window.location.href = 'residents.html';
        }
        return null;
    }
    return {
        user: sessionData.session.user,
        profil: profil
    };
}

async function verifierAuth() {
    const result = await verifierAuthEtRole(null);
    return result ? result.user : null;
}

async function seDeconnecter() {
    await supaClient.auth.signOut();
    window.location.href = 'login.html';
}