# Guide de Déploiement - Base44 App

Ce guide explique comment déployer l'application React sur un serveur web et résoudre les problèmes d'erreur 404 lors du rechargement de page.

## 🚀 Build et Déploiement

### 1. Build de l'application

```bash
# Build standard (recommandé)
npm run build

# Ou build Vite uniquement
npm run build:vite
```

Le script de build personnalisé (`build.js`) :
- Compile l'application avec Vite
- Copie automatiquement le fichier `.htaccess` dans le dossier `dist/`
- Copie le fichier `nginx.conf` pour référence

### 2. Contenu à déployer

Uploadez tout le contenu du dossier `dist/` sur votre serveur web.

## 🔧 Configuration Serveur

### Apache (Recommandé)

Le fichier `.htaccess` est automatiquement inclus dans le build et configure :
- ✅ Redirection automatique vers `index.html` pour le routing côté client
- ✅ Compression des fichiers
- ✅ Cache des assets statiques
- ✅ Headers de sécurité

**Aucune configuration supplémentaire requise !**

### Nginx

Si vous utilisez Nginx, utilisez la configuration fournie dans `nginx.conf` :

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/your/dist;
    index index.html;
    
    # Gestion du routing côté client
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache des assets statiques
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
}
```

### Autres serveurs

Pour d'autres serveurs web, assurez-vous de configurer le **fallback vers `index.html`** pour toutes les routes qui ne correspondent pas à des fichiers existants.

## 🐛 Résolution des Problèmes

### Erreur 404 lors du rechargement

**Problème :** L'erreur 404 se produit quand vous rechargez une page ou accédez directement à une URL comme `/Broker` ou `/DSP`.

**Cause :** Le serveur ne sait pas comment gérer les routes côté client de React Router.

**Solution :** 
1. ✅ Vérifiez que le fichier `.htaccess` est présent dans votre dossier de déploiement
2. ✅ Pour Nginx, utilisez la configuration fournie
3. ✅ Testez avec `npm run preview:production` avant le déploiement

### Test local

```bash
# Test du build en local
npm run preview:production
```

Visitez `http://localhost:4173` et testez la navigation et le rechargement des pages.

## 📁 Structure des Fichiers

```
dist/
├── index.html          # Point d'entrée de l'application
├── .htaccess          # Configuration Apache (automatique)
├── nginx.conf         # Configuration Nginx (référence)
└── assets/            # Fichiers CSS/JS compilés
    ├── index-[hash].css
    └── index-[hash].js
```

## 🔍 Vérification du Déploiement

1. **Navigation normale :** Testez la navigation entre les pages
2. **Rechargement :** Rechargez chaque page (F5 ou Ctrl+R)
3. **URL directe :** Accédez directement aux URLs comme `/Broker`, `/DSP`, etc.
4. **Console :** Vérifiez qu'il n'y a pas d'erreurs dans la console du navigateur

## 🚨 Points d'Attention

- ⚠️ **Apache :** Assurez-vous que le module `mod_rewrite` est activé
- ⚠️ **Nginx :** La directive `try_files` est essentielle
- ⚠️ **CDN :** Si vous utilisez un CDN, configurez-le pour servir `index.html` pour les routes non trouvées

## 📞 Support

Si vous rencontrez encore des problèmes :
1. Vérifiez les logs de votre serveur web
2. Testez en local avec `npm run preview:production`
3. Vérifiez que tous les fichiers du dossier `dist/` sont bien uploadés
