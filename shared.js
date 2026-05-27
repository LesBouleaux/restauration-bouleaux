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
const TABLE_CATEGORIES_EJC = 'categories_ejc';
const TABLE_CLIENTS = 'clients';

// ===== CONTEXTE GLOBAL DE L'UTILISATEUR CONNECTÉ =====
let CONTEXTE_CLIENT = null;

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

function lundiDeLaSemaine(date) {
    const d = new Date(date);
    const jour = d.getDay();
    const diff = jour === 0 ? -6 : 1 - jour;
    d.setDate(d.getDate() + diff);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

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

// ⚠️ Versions legacy (valeurs en dur) — conservées pour compatibilité
function commandeOuverte(lundiSemaineConcernee) {
    const lundi = new Date(lundiSemaineConcernee + 'T00:00:00');
    const limite = new Date(lundi);
    limite.setDate(lundi.getDate() - 6);
    limite.setHours(12, 0, 0, 0);
    return new Date() < limite;
}

function annulationOuverte(dateIso) {
    const d = new Date(dateIso + 'T08:00:00');
    return new Date() < d;
}

// ============================================================
// SEMAINE EJC - VERSIONS PARAMÉTRABLES PAR CLIENT
// Les règles sont désormais lues dynamiquement depuis la table
// regles_client_periode selon la date concernée.
//
// ⚠️ Ces fonctions sont ASYNCHRONES (async/await).
//    Les pages appelantes doivent utiliser "await".
// ============================================================

// Cache mémoire des règles déjà chargées, pour éviter de
// retaper la base à chaque appel sur la même page.
// Clé : `${client_id}::${dateRepasIso}` → règles
const _cacheReglesClient = {};

// Récupère la règle applicable pour un client à une date donnée.
// Renvoie un objet règles, ou null si aucune règle n'est définie
// pour ce client à cette date (cas d'erreur : il faut alerter).
async function getReglesClient(client, dateRepasIso) {
    if (!client || !client.id) return null;
    if (!dateRepasIso) {
        console.warn('getReglesClient : dateRepasIso manquante');
        return null;
    }

    const cacheKey = `${client.id}::${dateRepasIso}`;
    if (_cacheReglesClient[cacheKey]) return _cacheReglesClient[cacheKey];

    const { data, error } = await supaClient
        .from('regles_client_periode')
        .select('*')
        .eq('client_id', client.id)
        .lte('date_debut', dateRepasIso)
        .or(`date_fin.is.null,date_fin.gte.${dateRepasIso}`)
        .order('date_debut', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Erreur lecture regles_client_periode :', error);
        return null;
    }
    if (!data) {
        console.warn(`Aucune règle définie pour client ${client.id} à la date ${dateRepasIso}`);
        return null;
    }

    // Format de retour homogène (compatible avec l'ancien getReglesClient)
    const jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    const regles = {
        // Identité de la règle
        id: data.id,
        libelle_contrat: data.libelle_contrat,
        date_debut: data.date_debut,
        date_fin: data.date_fin,

        // Deadline de commande
        deadlineJour: data.deadline_jour,
        deadlineJourLibelle: jours[data.deadline_jour],
        deadlineHeure: data.deadline_heure,
        deadlineMinute: data.deadline_minute,

        // Annulation à 24h (gratuite)
        annulation24hActive: data.annulation_24h_active,
        annulation24hPlafondPct: data.annulation_24h_plafond_pct,

        // Annulation tardive (jour J)
        deadlineAnnulationHeure: data.deadline_annulation_heure,
        deadlineAnnulationMinute: data.deadline_annulation_minute,
        pctAnnulationJourJ: data.pct_annulation_jour_j
    };

    _cacheReglesClient[cacheKey] = regles;
    return regles;
}

// Vide le cache (utile après modif des règles, ou changement de client)
function viderCacheReglesClient() {
    for (const k in _cacheReglesClient) delete _cacheReglesClient[k];
}

// Calcule le moment limite (Date JS) pour commander la semaine
// du lundi donné, selon les règles du client à cette date.
async function calculerDeadlineCommande(lundiSemaineConcernee, client) {
    const regles = await getReglesClient(client, lundiSemaineConcernee);
    if (!regles) return null;

    const lundi = new Date(lundiSemaineConcernee + 'T00:00:00');
    const lundiSemPrecedente = new Date(lundi);
    lundiSemPrecedente.setDate(lundi.getDate() - 7);
    const deadline = new Date(lundiSemPrecedente);
    const decalage = (regles.deadlineJour - 1 + 7) % 7;
    deadline.setDate(lundiSemPrecedente.getDate() + decalage);
    deadline.setHours(regles.deadlineHeure, regles.deadlineMinute, 0, 0);
    return deadline;
}

// La saisie de commande est-elle encore ouverte pour cette semaine ?
async function commandeOuverteClient(lundiSemaineConcernee, client) {
    const deadline = await calculerDeadlineCommande(lundiSemaineConcernee, client);
    if (!deadline) return false;
    return new Date() < deadline;
}

// L'annulation tardive est-elle encore possible pour cette date ?
async function annulationOuverteClient(dateRepasIso, client) {
    const regles = await getReglesClient(client, dateRepasIso);
    if (!regles) return false;

    const d = new Date(dateRepasIso + 'T00:00:00');
    d.setHours(regles.deadlineAnnulationHeure, regles.deadlineAnnulationMinute, 0, 0);
    return new Date() < d;
}

// Classifie une annulation selon la règle applicable et l'instant de saisie.
// Renvoie l'une des chaînes :
//   'gratuite'        — annulation à 24h+ sous l'ancien contrat
//   'tardive_50pct'   — annulation le jour J avant la deadline d'annulation
//   'refusee'         — annulation après la deadline d'annulation
//   'plafond_depasse' — annulation à 24h+ qui dépasserait le plafond (ancien contrat uniquement)
//   'erreur_pas_de_regle'  — aucune règle définie (bloquant)
// Cette fonction NE FAIT QUE classer, elle ne décide pas d'autoriser ou non.
async function classifierAnnulation(client, dateRepasIso, instantSaisie) {
    const regles = await getReglesClient(client, dateRepasIso);
    if (!regles) return 'erreur_pas_de_regle';

    const dateRepas = new Date(dateRepasIso + 'T00:00:00');
    const deadlineTardive = new Date(dateRepasIso + 'T00:00:00');
    deadlineTardive.setHours(regles.deadlineAnnulationHeure, regles.deadlineAnnulationMinute, 0, 0);

    // 24h avant l'heure de livraison (on prend 11h30 comme heure de livraison standard)
    const deadline24h = new Date(dateRepas);
    deadline24h.setDate(deadline24h.getDate() - 1);
    deadline24h.setHours(11, 30, 0, 0);

    const t = instantSaisie || new Date();

    // Cas 1 : on est encore à plus de 24h
    if (t < deadline24h) {
        if (regles.annulation24hActive) return 'gratuite';
        // Le nouveau contrat n'a pas de fenêtre 24h explicite, donc dans la veille
        // c'est traité comme une saisie normale = gratuite tant que dans la journée.
        return 'gratuite';
    }

    // Cas 2 : on est dans la fenêtre tardive (entre 24h avant et la deadline du jour J)
    if (t < deadlineTardive) {
        return 'tardive_' + regles.pctAnnulationJourJ + 'pct';
    }

    // Cas 3 : trop tard
    return 'refusee';
}
// ============================================================
// AUTH - Vérification connexion + rôle
// ============================================================

async function verifierAuthEtRole(rolesAutorises) {
    const { data: { session } } = await supaClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }

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

    if (rolesAutorises && rolesAutorises.length && !rolesAutorises.includes(profil.role)) {
        alert('⛔ Vous n\'avez pas accès à cette page.');
        if (profil.role === 'admin') window.location.href = 'dashboard.html';
        else if (profil.role === 'client_ejc') window.location.href = 'commande-ejc.html';
        else window.location.href = 'login.html';
        return null;
    }

    return { user: session.user, profil };
}
// ============================================================
// CONTEXTE CLIENT - chargement enrichi (multi-clients)
// ============================================================

async function chargerContexteClient(rolesAutorises) {
    const auth = await verifierAuthEtRole(rolesAutorises);
    if (!auth) return null;

    let client = null;
    if (auth.profil.client_id) {
        const { data, error } = await supaClient
            .from(TABLE_CLIENTS)
            .select('*')
            .eq('id', auth.profil.client_id)
            .maybeSingle();
        if (error) {
            console.error('Erreur chargement client :', error);
        } else {
            client = data;
        }
    }

    CONTEXTE_CLIENT = {
        user: auth.user,
        profil: auth.profil,
        client: client
    };
    return CONTEXTE_CLIENT;
}

function getClientCourant() {
    return CONTEXTE_CLIENT?.client || null;
}

async function chargerTousLesClients(uniquementActifs = true) {
    let query = supaClient
        .from(TABLE_CLIENTS)
        .select('*')
        .order('nom', { ascending: true });
    if (uniquementActifs) query = query.eq('actif', true);

    const { data, error } = await query;
    if (error) {
        console.error('Erreur chargement clients :', error);
        return [];
    }
    return data || [];
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
// EN-TÊTE AVEC LOGO
// ============================================================

function afficherEntete() {
    const entete = document.getElementById('app-header');
    if (entete) {
        entete.innerHTML = `<img src="images/logo.png" alt="Restauration Les Bouleaux" class="logo">`;
    }
}

// ============================================================
// MENU À GROUPES DÉROULANTS
// 9 boutons principaux, sous-menus dynamiques au clic
// ============================================================
const GROUPES_MENU_ADMIN = [
    {
        id: 'accueil',
        titre: '🏠 Accueil',
        type: 'direct',
        onglet: { id: 'accueil', titre: '🏠 Accueil', url: 'dashboard.html' }
    },
    {
        id: 'residents',
        titre: '👥 Résidents',
        type: 'groupe',
        onglets: [
            { id: 'residents-bouleaux',   titre: '👥 Résidents Bouleaux',   url: 'residents-bouleaux.html' },
            { id: 'residents-passerelle', titre: '🌉 Résidents Passerelle', url: 'residents-passerelle.html' },
            { id: 'presences-bouleaux',   titre: '✅ Présences Bouleaux',   url: 'presences-bouleaux.html' },
            { id: 'presences-passerelle', titre: '✅ Présences Passerelle', url: 'presences-passerelle.html' }
        ]
    },
    {
        id: 'cuisine',
        titre: '🍽️ Cuisine',
        type: 'groupe',
        onglets: [
            { id: 'production',      titre: '📋 Production J-1',  url: 'production.html' },
            { id: 'service-du-jour', titre: '🍽️ Service du jour', url: 'service.html' }
        ]
    },
    {
    id: 'ejc',
    titre: '📝 Clients externes',
    type: 'groupe',
    onglets: [
        { id: 'commande-ejc',       titre: '📝 Commandes externes', url: 'commande-ejc.html' },
        { id: 'categories-clients', titre: '🏷️ Catégories clients', url: 'categories-clients.html' },
        { id: 'journaux-audit',     titre: '📋 Journaux d\'audit',  url: 'journaux-audit.html' }
    ]
},
    {
        id: 'domicile',
        titre: '🏠 Repas à domicile',
        type: 'groupe',
        onglets: [
            { id: 'repas-domicile',     titre: '🏠 Fiches domicile',    url: 'repas-domicile.html' },
            { id: 'presences-domicile', titre: '🗓️ Présences domicile', url: 'presences-domicile.html' }
        ]
    },
    {
        id: 'appartement',
        titre: '🏨 Appartement',
        type: 'groupe',
        onglets: [
            { id: 'sejours-appartement',    titre: '📅 Séjours',           url: 'sejours-appartement.html' },
            { id: 'personnes-appartement',  titre: '🏨 Personnes',         url: 'personnes-appartement.html' },
            { id: 'presences-appartement',  titre: '✅ Présences',         url: 'presences-appartement.html' },
            { id: 'caisse-appartement',     titre: '💰 Caisse',            url: 'caisse-appartement.html' },
            { id: 'catalogue-appartement',  titre: '🏷️ Catalogue',         url: 'catalogue-appartement.html' },
            { id: 'commandes-appartement',  titre: '🛒 Commandes',         url: 'commandes-appartement.html' },
            { id: 'livraisons-cuisine',     titre: '📦 Livraisons cuisine', url: 'livraisons-cuisine.html' }
        ]
    },
    {
        id: 'compta',
        titre: '💰 Compta',
        type: 'groupe',
        onglets: [
            { id: 'recap-clients',     titre: '📊 Récap clients externes', url: 'recap-clients.html' },
            { id: 'recap-domicile',    titre: '📊 Récap domicile',         url: 'recap-domicile.html' },
            { id: 'recap-appartement', titre: '📊 Récap appartement',      url: 'recap-appartement.html' },
            { id: 'factures-clients',  titre: '🧾 Factures clients',       url: 'factures-clients-admin.html' }
        ]
    },
    {
        id: 'statistiques',
        titre: '📊 Statistiques',
        type: 'direct',
        onglet: { id: 'statistiques', titre: '📊 Statistiques', url: 'stats.html' }
    },
    {
        id: 'direction',
        titre: '🏛️ Direction',
        type: 'groupe',
        onglets: [
            { id: 'parametres',       titre: '⚙️ Paramètres généraux', url: 'parametres.html' },
            { id: 'residents-sortis', titre: '📤 Résidents sortis',    url: 'residents-sortis.html' }
        ]
    }
];

// Liste des ids/alias d'onglets qui doivent activer le bouton "Accueil"
// (au cas où certaines pages s'identifient sous d'autres noms)
const ALIAS_ACCUEIL = ['accueil', 'dashboard'];

function genererMenuOnglets(pageActive, role) {
    // Menu spécifique pour les clients EJC
    if (role === 'client_ejc') {
        let h = '<div class="menu-onglets">';
        const ongletsEjc = [
            { id: 'dashboard',    titre: '🏠 Accueil',      url: 'dashboard.html' },
            { id: 'commande-ejc', titre: '🍽️ Saisie repas', url: 'commande-ejc.html' },
            { id: 'factures-ejc', titre: '🧾 Mes factures', url: 'factures-ejc.html' }
        ];
        for (const o of ongletsEjc) {
            const cls = o.id === pageActive ? 'active' : '';
            h += `<a href="${o.url}" class="onglet ${cls}">${o.titre}</a>`;
        }
        h += '</div>';
        return h;
    }

    // Cherche le groupe qui contient la page active (pour la mise en évidence)
    let groupeActifId = null;
    GROUPES_MENU_ADMIN.forEach(grp => {
        if (grp.type === 'direct') {
            // Accueil accepte les alias 'accueil' OU 'dashboard'
            if (grp.id === 'accueil') {
                if (ALIAS_ACCUEIL.includes(pageActive)) groupeActifId = grp.id;
            } else if (grp.onglet.id === pageActive) {
                groupeActifId = grp.id;
            }
        } else if (grp.type === 'groupe') {
            grp.onglets.forEach(o => {
                if (o.id === pageActive) groupeActifId = grp.id;
            });
        }
    });

    let html = '<div class="menu-onglets-bar">';

    GROUPES_MENU_ADMIN.forEach(grp => {
        const estActif = grp.id === groupeActifId;

        if (grp.type === 'direct') {
            html += '<a href="' + grp.onglet.url + '" '
                  + 'class="onglet-direct' + (estActif ? ' actif' : '') + '">'
                  + grp.titre
                  + '</a>';
        } else {
            html += '<div class="groupe-menu' + (estActif ? ' actif' : '') + '" data-grp="' + grp.id + '">'
                  +   '<button type="button" class="groupe-btn" onclick="toggleSousMenu(\'' + grp.id + '\')">'
                  +     grp.titre + ' <span class="chev">▾</span>'
                  +   '</button>'
                  +   '<div class="sous-menu" id="sous-menu-' + grp.id + '">';

            grp.onglets.forEach(o => {
                const ongletActif = o.id === pageActive;
                html += '<a href="' + o.url + '" class="sous-menu-item' + (ongletActif ? ' actif' : '') + '">'
                      + o.titre
                      + '</a>';
            });

            html += '  </div>'
                  + '</div>';
        }
    });

    html += '</div>';
    return html;
}

// Ouvre / ferme le sous-menu d'un groupe
function toggleSousMenu(grpId) {
    const tous = document.querySelectorAll('.sous-menu');
    const groupes = document.querySelectorAll('.groupe-menu');
    const cible = document.getElementById('sous-menu-' + grpId);
    const grpCible = document.querySelector('.groupe-menu[data-grp="' + grpId + '"]');
    const estOuvert = cible && cible.classList.contains('ouvert');

    tous.forEach(sm => sm.classList.remove('ouvert'));
    groupes.forEach(g => g.classList.remove('ouvert'));

    if (!estOuvert && cible) {
        cible.classList.add('ouvert');
        if (grpCible) grpCible.classList.add('ouvert');
    }
}

// Ferme les sous-menus quand on clique ailleurs
document.addEventListener('click', function(e) {
    if (!e.target.closest('.groupe-menu')) {
        document.querySelectorAll('.sous-menu').forEach(sm => sm.classList.remove('ouvert'));
        document.querySelectorAll('.groupe-menu').forEach(g => g.classList.remove('ouvert'));
    }
});

function afficherMenu(pageActive) {
    afficherEntete();
    const menu = document.getElementById('menu');
    if (menu) menu.innerHTML = genererMenuOnglets(pageActive, 'admin');
}

function afficherMenuComplet(pageActive, emailUtilisateur, role, nomAffiche) {
    afficherEntete();
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
// UNITÉS D'HÉBERGEMENT (Bouleaux / Passerelle)
// ============================================================

const UNITES_LISTE = [
    { code: 'bouleaux',   nom: 'Bouleaux',   emoji: '🏠' },
    { code: 'passerelle', nom: 'Passerelle', emoji: '🌉' }
];

function nomUnite(code) {
    const u = UNITES_LISTE.find(x => x.code === code);
    return u ? `${u.emoji} ${u.nom}` : code;
}

function nomUniteSansEmoji(code) {
    const u = UNITES_LISTE.find(x => x.code === code);
    return u ? u.nom : code;
}

// ============================================================
// TEXTURES MODIFIÉES
// ============================================================

const TEXTURE_DEFAUT = 'normale';

const TEXTURES_LISTE = [
    { code: 'normale',      nom: 'Normale',      emoji: '🍽️' },
    { code: 'mixe_lisse',   nom: 'Mixé lisse',   emoji: '🥣' },
    { code: 'coupe',        nom: 'Coupé',        emoji: '🔪' },
    { code: 'viande_mixe',  nom: 'Viande mixée', emoji: '🥩' },
    { code: 'liquide',      nom: 'Liquide',      emoji: '🥤' },
    { code: 'mixe_sucre',   nom: 'Mixé sucré',   emoji: '🍮' }
];

function nomTexture(code) {
    const t = TEXTURES_LISTE.find(x => x.code === code);
    return t ? `${t.emoji} ${t.nom}` : code;
}

function nomTextureSansEmoji(code) {
    const t = TEXTURES_LISTE.find(x => x.code === code);
    return t ? t.nom : code;
}

function getTextureDefautResident(resident, repas) {
    if (!resident) return TEXTURE_DEFAUT;
    switch (repas) {
        case 'petit_dej': return resident.texture_defaut_petit_dej || TEXTURE_DEFAUT;
        case 'dejeuner':  return resident.texture_defaut_dejeuner  || TEXTURE_DEFAUT;
        case 'diner':     return resident.texture_defaut_diner     || TEXTURE_DEFAUT;
        default:          return TEXTURE_DEFAUT;
    }
}

function selectTextureHtml(nomChamp, valeurSelectionnee = TEXTURE_DEFAUT, attributs = '') {
    let html = `<select name="${nomChamp}" ${attributs}>`;
    for (const t of TEXTURES_LISTE) {
        const sel = t.code === valeurSelectionnee ? 'selected' : '';
        html += `<option value="${t.code}" ${sel}>${t.emoji} ${t.nom}</option>`;
    }
    html += '</select>';
    return html;
}

// ============================================================
// RÉSIDENTS - Chargement
// ============================================================

async function chargerResidentsActifs(unite = null) {
    let query = supaClient
        .from(TABLE_RESIDENTS)
        .select('*')
        .eq('actif', true)
        .order('prenom', { ascending: true });
    if (unite) query = query.eq('unite', unite);

    const { data, error } = await query;
    if (error) {
        console.error('Erreur chargement résidents :', error);
        return [];
    }
    return data || [];
}

async function chargerResidentsParUnite(unite) {
    return chargerResidentsActifs(unite);
}

// ============================================================
// CATÉGORIES EJC - Chargement
// ============================================================

async function chargerCategoriesEjc(uniquementActives = true, clientId = null) {
    let query = supaClient
        .from(TABLE_CATEGORIES_EJC)
        .select('*')
        .order('ordre', { ascending: true })
        .order('nom', { ascending: true });
    if (uniquementActives) query = query.eq('actif', true);
    if (clientId) query = query.eq('client_id', clientId);

    const { data, error } = await query;
    if (error) {
        console.error('Erreur chargement catégories EJC :', error);
        return [];
    }
    return data || [];
}

// Liste des 14 allergènes majeurs (réutilisable partout)
const ALLERGENES_LISTE = [
    { code: 'gluten',         nom: 'Gluten',           emoji: '🌾' },
    { code: 'crustaces',      nom: 'Crustacés',        emoji: '🦐' },
    { code: 'oeufs',          nom: 'Œufs',             emoji: '🥚' },
    { code: 'poissons',       nom: 'Poissons',         emoji: '🐟' },
    { code: 'arachides',      nom: 'Arachides',        emoji: '🥜' },
    { code: 'soja',           nom: 'Soja',             emoji: '🌱' },
    { code: 'lait',           nom: 'Lait',             emoji: '🥛' },
    { code: 'fruits_a_coque', nom: 'Fruits à coque',   emoji: '🌰' },
    { code: 'celeri',         nom: 'Céleri',           emoji: '🥬' },
    { code: 'moutarde',       nom: 'Moutarde',         emoji: '🟡' },
    { code: 'sesame',         nom: 'Graines de sésame',emoji: '🌻' },
    { code: 'sulfites',       nom: 'Sulfites',         emoji: '🧪' },
    { code: 'lupin',          nom: 'Lupin',            emoji: '🌿' },
    { code: 'mollusques',     nom: 'Mollusques',       emoji: '🦪' }
];

function nomAllergene(code) {
    const a = ALLERGENES_LISTE.find(x => x.code === code);
    return a ? `${a.emoji} ${a.nom}` : code;
}

// ============================================================
// ABSENCES PROLONGÉES
// ============================================================

const TABLE_ABSENCES = 'absences_prolongees';

async function chargerAbsencesPourDate(dateIso) {
    const { data, error } = await supaClient
        .from(TABLE_ABSENCES)
        .select('*')
        .lte('date_debut', dateIso)
        .gte('date_fin', dateIso);
    if (error) {
        console.error('Erreur chargement absences :', error);
        return [];
    }
    return data || [];
}

async function chargerAbsencesPeriode(date1, date2) {
    const { data, error } = await supaClient
        .from(TABLE_ABSENCES)
        .select('*')
        .lte('date_debut', date2)
        .gte('date_fin', date1);
    if (error) {
        console.error('Erreur chargement absences :', error);
        return [];
    }
    return data || [];
}

function indexerAbsencesPourDateRepas(absences, dateIso, repas) {
    const map = {};
    for (const a of (absences || [])) {
        if (dateIso < a.date_debut || dateIso > a.date_fin) continue;
        const repasConcernes = a.repas_concernes || ['petit_dej', 'dejeuner', 'diner'];
        if (!repasConcernes.includes(repas)) continue;
        if (!map[a.resident_id]) map[a.resident_id] = a;
    }
    return map;
}

function estEnAbsenceProlongee(absences, residentId, dateIso, repas) {
    for (const a of (absences || [])) {
        if (a.resident_id !== residentId) continue;
        if (dateIso < a.date_debut || dateIso > a.date_fin) continue;
        const repasConcernes = a.repas_concernes || ['petit_dej', 'dejeuner', 'diner'];
        if (!repasConcernes.includes(repas)) continue;
        return a;
    }
    return null;
}