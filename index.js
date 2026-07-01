const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const app = express()
const PORT = process.env.PORT || 3002
const SECRET = 'cleanfix_secret_2025'

// Données en mémoire (pour la démo)
let utilisateurs = []
let reservations = []
const prestations = [
  { id: 1, emoji: '🚿', titre: 'Lavage extérieur', prix: 3000 },
  { id: 2, emoji: '🪑', titre: 'Sièges & Intérieur', prix: 6000 },
  { id: 3, emoji: '✨', titre: 'Polissage', prix: 20000 },
  { id: 4, emoji: '🌿', titre: 'Éco sans eau', prix: 4000 },
]

app.use(cors())
app.use(express.json())

// Test
app.get('/', (req, res) => {
  res.json({ message: '🚗 CleanFix CI API — Serveur opérationnel !' })
})

// Prestations
app.get('/api/prestations', (req, res) => {
  res.json(prestations)
})

// Inscription
app.post('/api/inscription', async (req, res) => {
  const { nom, telephone, mot_de_passe } = req.body
  if (!nom || !telephone || !mot_de_passe) {
    return res.status(400).json({ erreur: 'Tous les champs sont obligatoires' })
  }
  const existe = utilisateurs.find(u => u.telephone === telephone)
  if (existe) return res.status(400).json({ erreur: 'Numéro déjà utilisé' })
  const hash = await bcrypt.hash(mot_de_passe, 10)
  const utilisateur = { id: utilisateurs.length + 1, nom, telephone, mot_de_passe: hash }
  utilisateurs.push(utilisateur)
  const token = jwt.sign({ id: utilisateur.id, nom, telephone }, SECRET, { expiresIn: '7d' })
  console.log(`✅ Nouvel utilisateur : ${nom}`)
  res.status(201).json({ token, utilisateur: { id: utilisateur.id, nom, telephone } })
})

// Connexion
app.post('/api/connexion', async (req, res) => {
  const { telephone, mot_de_passe } = req.body
  const utilisateur = utilisateurs.find(u => u.telephone === telephone)
  if (!utilisateur) return res.status(400).json({ erreur: 'Numéro introuvable' })
  const valide = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe)
  if (!valide) return res.status(400).json({ erreur: 'Mot de passe incorrect' })
  const token = jwt.sign({ id: utilisateur.id, nom: utilisateur.nom, telephone }, SECRET, { expiresIn: '7d' })
  console.log(`✅ Connexion : ${utilisateur.nom}`)
  res.json({ token, utilisateur: { id: utilisateur.id, nom: utilisateur.nom, telephone } })
})

// Créer réservation
app.post('/api/reservations', (req, res) => {
  const { prestation, adresse, date } = req.body
  if (!prestation || !adresse) {
    return res.status(400).json({ erreur: 'Prestation et adresse obligatoires' })
  }
  const reservation = {
    id: reservations.length + 1,
    prestation, adresse,
    date: date || "Aujourd'hui",
    statut: 'confirmée',
    prestataire: 'Kouassi Bernard',
    eta: '12 minutes'
  }
  reservations.push(reservation)
  console.log('📋 Réservation :', reservation)
  res.status(201).json(reservation)
})

// Récupérer réservations
app.get('/api/reservations', (req, res) => {
  res.json(reservations)
})

app.listen(PORT, () => {
  console.log(`✅ Serveur CleanFix CI démarré sur http://localhost:${PORT}`)
})