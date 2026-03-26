#!/usr/bin/env node

/**
 * Script de build personnalisé pour gérer le déploiement
 * Ce script copie automatiquement les fichiers de configuration nécessaires
 */

import { build } from 'vite';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function customBuild() {
    console.log('🚀 Starting custom build process...');
    
    try {
        // Build the application
        console.log('📦 Building application...');
        await build();
        console.log('✅ Build completed successfully!');
        
        // Copy nginx.conf to dist directory for reference
        const nginxSource = join(__dirname, 'nginx.conf');
        const nginxDest = join(__dirname, 'dist', 'nginx.conf');
        
        if (existsSync(nginxSource)) {
            copyFileSync(nginxSource, nginxDest);
            console.log('✅ nginx.conf file copied to dist/ for reference');
        }
        
        // Copy JSON configs to dist for easy editing post-deploy
        const creativeScanSrc = join(__dirname, 'src', 'pages', 'Realm', 'creative-scan-policies.json');
        const creativeScanDest = join(__dirname, 'dist', 'creative-scan-policies.json');
        if (existsSync(creativeScanSrc)) {
            copyFileSync(creativeScanSrc, creativeScanDest);
            console.log('✅ creative-scan-policies.json copied to dist/');
        } else {
            console.log('⚠️  creative-scan-policies.json not found, skipping...');
        }
        
        const placementMappingSrc = join(__dirname, 'src', 'pages', 'Broker', 'placement-broker-mapping.json');
        const placementMappingDest = join(__dirname, 'dist', 'placement-broker-mapping.json');
        if (existsSync(placementMappingSrc)) {
            copyFileSync(placementMappingSrc, placementMappingDest);
            console.log('✅ placement-broker-mapping.json copied to dist/');
        } else {
            console.log('⚠️  placement-broker-mapping.json not found, skipping...');
        }
        
        // Copy all Business Review JSON files from data/DSP/ to dist/data/DSP/
        const dataDspSource = join(__dirname, 'data', 'DSP');
        const dataDspDest = join(__dirname, 'dist', 'data', 'DSP');
        
        if (existsSync(dataDspSource)) {
            // Create destination directory if it doesn't exist
            if (!existsSync(dataDspDest)) {
                mkdirSync(dataDspDest, { recursive: true });
            }
            
            // Read all files in data/DSP/
            const files = readdirSync(dataDspSource);
            const businessReviewFiles = files.filter(file => file.startsWith('business-review-') && file.endsWith('.json'));
            
            if (businessReviewFiles.length > 0) {
                businessReviewFiles.forEach(file => {
                    const sourceFile = join(dataDspSource, file);
                    const destFile = join(dataDspDest, file);
                    copyFileSync(sourceFile, destFile);
                });
                console.log(`✅ Copied ${businessReviewFiles.length} Business Review JSON file(s) to dist/data/DSP/`);
            } else {
                console.log('⚠️  No Business Review JSON files found in data/DSP/, skipping...');
            }
        } else {
            console.log('⚠️  data/DSP/ directory not found, skipping...');
        }
        
        // Copy all Business Review JSON files from data/REALM/ to dist/data/REALM/
        const dataRealmSource = join(__dirname, 'data', 'REALM');
        const dataRealmDest = join(__dirname, 'dist', 'data', 'REALM');
        
        if (existsSync(dataRealmSource)) {
            // Create destination directory if it doesn't exist
            if (!existsSync(dataRealmDest)) {
                mkdirSync(dataRealmDest, { recursive: true });
            }
            
            // Read all files in data/REALM/
            const realmFiles = readdirSync(dataRealmSource);
            const realmBusinessReviewFiles = realmFiles.filter(file => file.startsWith('business-review-') && file.endsWith('.json'));
            
            if (realmBusinessReviewFiles.length > 0) {
                realmBusinessReviewFiles.forEach(file => {
                    const sourceFile = join(dataRealmSource, file);
                    const destFile = join(dataRealmDest, file);
                    copyFileSync(sourceFile, destFile);
                });
                console.log(`✅ Copied ${realmBusinessReviewFiles.length} Realm Business Review JSON file(s) to dist/data/REALM/`);
            } else {
                console.log('⚠️  No Business Review JSON files found in data/REALM/, skipping...');
            }
        } else {
            console.log('⚠️  data/REALM/ directory not found, skipping...');
        }
        
        // Copy all Business Review JSON files from data/COMPANY/ to dist/data/COMPANY/
        const dataCompanySource = join(__dirname, 'data', 'COMPANY');
        const dataCompanyDest = join(__dirname, 'dist', 'data', 'COMPANY');
        
        if (existsSync(dataCompanySource)) {
            // Create destination directory if it doesn't exist
            if (!existsSync(dataCompanyDest)) {
                mkdirSync(dataCompanyDest, { recursive: true });
            }
            
            // Read all files in data/COMPANY/
            const companyFiles = readdirSync(dataCompanySource);
            const companyBusinessReviewFiles = companyFiles.filter(file => file.startsWith('business-review-') && file.endsWith('.json'));
            
            if (companyBusinessReviewFiles.length > 0) {
                companyBusinessReviewFiles.forEach(file => {
                    const sourceFile = join(dataCompanySource, file);
                    const destFile = join(dataCompanyDest, file);
                    copyFileSync(sourceFile, destFile);
                });
                console.log(`✅ Copied ${companyBusinessReviewFiles.length} Company Business Review JSON file(s) to dist/data/COMPANY/`);
            } else {
                console.log('⚠️  No Business Review JSON files found in data/COMPANY/, skipping...');
            }
        } else {
            console.log('⚠️  data/COMPANY/ directory not found, skipping...');
        }
        
        // Copy all Business Review JSON files from data/DEAL/ to dist/data/DEAL/
        const dataDealSource = join(__dirname, 'data', 'DEAL');
        const dataDealDest = join(__dirname, 'dist', 'data', 'DEAL');
        
        if (existsSync(dataDealSource)) {
            // Create destination directory if it doesn't exist
            if (!existsSync(dataDealDest)) {
                mkdirSync(dataDealDest, { recursive: true });
            }
            
            // Read all files in data/DEAL/
            const dealFiles = readdirSync(dataDealSource);
            const dealBusinessReviewFiles = dealFiles.filter(file => file.startsWith('business-review-') && file.endsWith('.json'));
            
            if (dealBusinessReviewFiles.length > 0) {
                dealBusinessReviewFiles.forEach(file => {
                    const sourceFile = join(dataDealSource, file);
                    const destFile = join(dataDealDest, file);
                    copyFileSync(sourceFile, destFile);
                });
                console.log(`✅ Copied ${dealBusinessReviewFiles.length} Deal Business Review JSON file(s) to dist/data/DEAL/`);
            } else {
                console.log('⚠️  No Business Review JSON files found in data/DEAL/, skipping...');
            }
        } else {
            console.log('⚠️  data/DEAL/ directory not found, skipping...');
        }
        
        console.log('🎉 Build process completed!');
        console.log('');
        console.log('📋 Next steps for deployment:');
        console.log('   1. Upload the contents of the dist/ folder to your web server');
        console.log('   2. For Nginx: Use the nginx.conf file as a reference');
        console.log('   4. Make sure your server is configured to serve static files');
        
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

// Run the build
customBuild();
