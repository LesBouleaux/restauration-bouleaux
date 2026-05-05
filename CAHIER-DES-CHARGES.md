# 📋 Cahier des charges — Restauration Les Bouleaux

> Document de référence validé le **5 mai 2026**  
> Auteur : Terry Sauvain · Rythme : intensif

---

## 🎯 Objectif global

Faire évoluer l'application restauration de la Résidence Les Bouleaux pour qu'elle puisse :
- Être utilisée par toute l'équipe interne avec des accès cloisonnés selon le métier
- Gérer plusieurs clients externes (EJC Péry, Écureuils, EJC Corgémont, à venir)
- Intégrer un module complet de **repas à domicile** avec interface concierge
- Garantir la continuité de service via un 2ème administrateur

---

## 👥 1. Utilisateurs

### 1.1 Utilisateurs internes (Résidence) — 7 rôles

| Rôle | Volume | Mission | Accès principaux |
|---|---|---|---|
| 👑 **admin** | 2 personnes | Gestion globale | Tous les onglets sans restriction |
| 💰 **comptabilite** | 1-2 | Gestion financière | Récap clients · Factures clients · Statistiques |
| 🩺 **soins** | 3-5 | Suivi résidents | Résidents · Présences · Absences prolongées |
| 👨‍🍳 **cuisine** | 2-3 | Production + commandes domicile | Production J-1 · Service du jour · Saisie commandes domicile |
| 🍽️ **restaurant** | 2-3 | Service + ajustements présences | Service du jour · Présences (modification) |
| 🛵 **concierge** | 1 | Livraisons domicile | Liste de livraisons · Marquage "livré" |

**Volume cible total : 9-15 utilisateurs internes**  
**Politique d'accès : cloisonnement strict** (chacun ne voit que ses pages)

### 1.2 Le 2ème administrateur (anti-bus factor)

- 🚌 Objectif : éviter le risque "1 seule personne maîtrise tout"
- 👤 Profil : collègue de confiance à la Résidence Les Bouleaux
- ⏱️ Quand : à créer plus tard (quand la personne sera identifiée et briefée)
- 📝 Formaliser dans un mini-document interne la responsabilité associée

### 1.3 Clients externes

| Client | Statut | Compte web | Modalités |
|---|---|---|---|
| 🍴 **EJC Péry** | ✅ Actif | Oui | Saisie repas en ligne + consultation factures |
| 🐿️ **Maison de l'enfance Les Écureuils** | ✅ Actif | Oui | Idem |
| 🍴 **EJC Corgémont** | 🔜 À créer | Oui | Idem (même architecture) |
| 🏠 **Clients à domicile** | 🆕 Module à concevoir | ❌ Non | Commandes par téléphone uniquement |

---

## 🏠 2. Module Repas à Domicile

### 2.1 Volumétrie

- **10 à 30 clients** à terme
- **Moins de 10 appels par jour** (volumétrie modérée)

### 2.2 Workflow général

```
1. 📞 Client appelle la résidence
2. 👨‍🍳 La cuisine prend la commande dans l'app (recherche client + formulaire rapide)
3. 📋 La commande est enregistrée avec : date, repas, options, adresse, particularités
4. 🛵 Le concierge consulte sa liste de livraisons du jour (smartphone ou papier imprimé)
5. ✅ Le concierge marque "livré + heure" au fur et à mesure
6. 💰 La comptabilité facture mensuellement
```

### 2.3 Caractéristiques fonctionnelles

| Aspect | Choix validé |
|---|---|
| **Compte web client** | ❌ Non — fichier client en base uniquement |
| **Type de commande** | Ponctuel + abonnement récurrent (mixte) |
| **Menus** | Même base que résidents + options spécifiques (portions, sans entrée, etc.) |
| **Prise de commande** | Cuisine uniquement (interface : recherche client + formulaire rapide) |
| **Livreur** | 1 seul concierge |
| **Fréquence livraison** | Selon les commandes (pas de tournée à vide) |
| **Interface concierge** | Smartphone (mobile) + option d'impression |
| **Suivi livraison** | Marquage "livré + heure" (pas de signature numérique) |
| **Facturation** | Mensuelle (cycle identique aux EJC) |

---

## 🗺️ 3. Roadmap de mise en œuvre

### Phase 1 — Finir le multi-clients en cours ⚡
**Durée estimée : ~30 minutes**

- [ ] Créer les vraies catégories EJC Péry
- [ ] Créer les vraies catégories Maison de l'enfance Les Écureuils
- [ ] Créer le client EJC Corgémont en base + ses catégories
- [ ] Créer les comptes utilisateurs des 3 clients

### Phase 2 — Architecture des rôles internes 🎭
**Durée estimée : 2 sessions**

- [ ] Étendre la liste des rôles dans la BDD : `comptabilite`, `soins`, `cuisine`, `restaurant`, `concierge`
- [ ] Créer une fonction helper `peutAcceder(page, role)` dans `shared.js`
- [ ] Adapter le menu pour qu'il s'affiche dynamiquement selon le rôle
- [ ] Adapter `verifierAuthEtRole()` sur chaque page avec les bons rôles
- [ ] Mettre à jour les politiques RLS Supabase au besoin
- [ ] Créer le 2ème admin (quand la personne est identifiée)
- [ ] Tester avec des comptes test pour chaque rôle

### Phase 3 — Module Repas à Domicile 🏠
**Durée estimée : 4-6 sessions**

#### 3.1 Base de données (1 session)
- [ ] Table `clients_domicile` (nom, prénom, adresse, téléphone, particularités, actif)
- [ ] Table `commandes_domicile` (date, client_id, type_commande, options, statut)
- [ ] Table `abonnements_domicile` (client_id, jours_semaine, repas, options, période)
- [ ] Table `livraisons` (commande_id, livré_le, heure_livraison, concierge_id)
- [ ] Politiques RLS adaptées

#### 3.2 Fichier client (1 session)
- [ ] Page `clients-domicile.html` (CRUD)
- [ ] Recherche par nom
- [ ] Gestion abonnements

#### 3.3 Prise de commande (1 session)
- [ ] Page `commande-domicile.html` (cuisine)
- [ ] Recherche client + formulaire rapide
- [ ] Gestion ponctuel vs abonnement

#### 3.4 Interface concierge (1 session)
- [ ] Page `livraisons.html` (mobile-friendly)
- [ ] Liste du jour avec adresses
- [ ] Bouton "marquer comme livré + heure"
- [ ] Version imprimable

#### 3.5 Facturation (1 session)
- [ ] Récap mensuel par client domicile
- [ ] Génération facture
- [ ] Intégration dans la page factures existante

### Phase 4 — Traçabilité résidents 🛡️
**Durée estimée : ~2h**

À intercaler quand bon te semble. Choix déjà validés :
- Signature manuelle obligatoire (pas électronique)
- Périmètre résidents uniquement (extensible plus tard)
- Affichage limité aux 5 dernières modifications
- Actions tracées : Création + Modification + Suppression
- Conservation de l'historique même si résident supprimé (soft-delete)

---

## ⚙️ 4. Contraintes techniques

### 4.1 Stack actuelle (à conserver)
- Frontend : HTML + CSS + JS vanilla
- Backend/DB : Supabase (PostgreSQL + Auth + Storage)
- Hébergement : GitHub Pages
- Versioning : Git + GitHub

### 4.2 Anticipation migration future
- Frontend = facile à déplacer (vanilla, pas de build)
- Supabase auto-hébergé envisageable un jour (Docker sur serveur interne)
- Garder une compatibilité PostgreSQL standard dans les requêtes

---

## 📊 5. Indicateurs de succès

L'application sera considérée comme aboutie quand :

- ✅ Chaque collègue a un compte avec son rôle adapté et n'accède qu'aux pages utiles à son métier
- ✅ Les 3 clients EJC + Écureuils utilisent l'app de façon autonome
- ✅ La cuisine peut prendre une commande domicile en moins de 30 secondes au téléphone
- ✅ Le concierge fait sa tournée avec sa liste sur smartphone et marque les livraisons en direct
- ✅ La compta génère ses factures clients (EJC + domicile) en quelques clics
- ✅ Un 2ème admin a été identifié et formé
- ✅ La continuité de service est garantie même en cas d'absence prolongée de l'admin principal

---

## 🚫 6. Hors périmètre (volontairement exclu)

Sujets explicitement écartés à la demande de Terry :
- Prix de vente, commercialisation, business
- Aspects juridiques commerciaux
- Vision commerciale globale
- Bot de support en lien avec la vente

L'application reste un **outil métier interne**, pas un produit commercial.

---

## 📝 7. Suivi et évolution de ce document

Ce cahier des charges est un **document vivant**. Il est mis à jour au fur et à mesure que :
- De nouveaux besoins émergent
- Des décisions techniques sont prises
- Des phases sont terminées (cocher les cases)

**Historique des versions :**
- v1.0 — 5 mai 2026 — Création initiale après session de cadrage
