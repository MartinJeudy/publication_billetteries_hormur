// netlify/functions/publish-event.js - VERSION DEBUG
exports.handler = async (event) => {
    console.log('🚀 Fonction démarrée - Version debug');
    
    // Gérer CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Seule la méthode POST est acceptée' })
        };
    }

    try {
        // Vérifier les variables d'environnement
        const envCheck = {
            EVENTIM_EMAIL: !!process.env.EVENTIM_EMAIL,
            EVENTIM_PASSWORD: !!process.env.EVENTIM_PASSWORD,
            JDS_EMAIL: !!process.env.JDS_EMAIL,
            JDS_PASSWORD: !!process.env.JDS_PASSWORD,
            ALLEVENTS_EMAIL: !!process.env.ALLEVENTS_EMAIL,
            ALLEVENTS_PASSWORD: !!process.env.ALLEVENTS_PASSWORD
        };

        const eventData = JSON.parse(event.body);
        console.log('📝 Données reçues:', {
            title: eventData.title,
            date: eventData.date
        });

        // Simuler le traitement pour chaque plateforme
        const results = {
            eventim: await simulatePublish('eventim', eventData, envCheck.EVENTIM_EMAIL && envCheck.EVENTIM_PASSWORD),
            jds: await simulatePublish('jds', eventData, envCheck.JDS_EMAIL && envCheck.JDS_PASSWORD),
            allevents: await simulatePublish('allevents', eventData, envCheck.ALLEVENTS_EMAIL && envCheck.ALLEVENTS_PASSWORD)
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Test de publication réussi',
                environmentVariables: envCheck,
                results: results,
                debug: {
                    nodeVersion: process.version,
                    environment: process.env.NODE_ENV || 'production',
                    timestamp: new Date().toISOString()
                }
            })
        };

    } catch (error) {
        console.error('❌ Erreur:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Erreur serveur',
                details: error.message,
                stack: error.stack
            })
        };
    }
};

async function simulatePublish(platform, eventData, hasCredentials) {
    console.log(`🔄 [${platform.toUpperCase()}] Simulation de publication`);
    
    // Simuler un délai
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    if (!hasCredentials) {
        console.log(`❌ [${platform.toUpperCase()}] Identifiants manquants`);
        return {
            success: false,
            platform: platform,
            error: 'Variables d\'environnement manquantes pour ' + platform
        };
    }

    // Simuler succès/échec aléatoire pour le test
    const success = Math.random() > 0.3; // 70% de succès
    
    if (success) {
        console.log(`✅ [${platform.toUpperCase()}] Publication simulée avec succès`);
        return {
            success: true,
            platform: platform,
            message: `Événement "${eventData.title}" publié sur ${platform} (simulation)`
        };
    } else {
        console.log(`⚠️ [${platform.toUpperCase()}] Échec simulé`);
        return {
            success: false,
            platform: platform,
            error: 'Erreur simulée pour test'
        };
    }
}
