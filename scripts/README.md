# Business Review Data Fetch Script

## Description

Ce script récupère les données Business Review depuis l'API `network_operations` pour un partner ID spécifique.

## Utilisation

```bash
# Avec token en argument
node scripts/fetchBusinessReviewData.js <auth_token>

# Ou avec variable d'environnement
export AUTH_TOKEN=your_token_here
node scripts/fetchBusinessReviewData.js
```

## Configuration

Le script est configuré pour :
- **Partner ID de test** : `75d56568a11564bfb79a01d2fa9fdb29`
- **Période** : Du 1er janvier de l'année en cours jusqu'à aujourd'hui
- **Granularité** : Par jour (P1D)
- **Dimension** : `adKind`
- **Filtre** : `partnerId`

## Métriques récupérées

- `network_operations_bid_requests`
- `network_operations_bid_responses`
- `network_operations_impressions`
- `network_operations_price_publisher`
- `network_operations_price_advertiser`
- `network_operations_click`

## Fonctionnement

Le script fait des requêtes séquentielles par mois pour éviter de faire de trop grosses requêtes. Chaque requête attend la fin de la précédente avant de commencer.

## Fichier de sortie

Les données sont sauvegardées dans :
```
data/business-review-{partnerId}.json
```

Le fichier JSON contient :
- Les métadonnées (partnerId, dateRange, metrics, dimensions)
- Le nombre total d'enregistrements
- La date de récupération
- Les données brutes de l'API



