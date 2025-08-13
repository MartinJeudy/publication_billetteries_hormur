// netlify/functions/publish-event.js - VERSION EVENTIM UNIQUEMENT
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const CREDENTIALS = {
    eventim: {
        email: process.env.EVENTIM_EMAIL,
        password: process.env.EVENTIM_PASSWORD
    }
};

// SÉLECTEURS PRÉCIS DEPUIS DEVTOOLS (EVENTIM UNIQUEMENT)
const SELECTORS = {
    eventim: {
        emailField: '#input-13',
        passwordField: '#input-15',
        loginButton: '[data-cy="login_button"] span.v-btn__content',
        eventNameField: '#input-56',
        categoryDropdown: '[data-cy="event-form-common-eventCategory"] i',
        concertsOption: '#v-menu-v-3 div:nth-of-type(2) > div.v-list-item__content > div',
        continueEventButton: '[data-cy="event"] > div.v-expansion-panel-text span.v-btn__content',
        dateField: '#input-72',
        continueScheduleButton: '[data-cy="schedule"] button.bg-primary',
        onlineEventButton: '[data-cy="event-form-location-switch-online"] span.v-btn__content',
        continueVenueButton: '[data-cy="venue"] button.bg-primary',
        quotaField: '#input-112',
        continueTicketButton: '[data-cy="ticket-area"] button.bg-primary',
        addFreeTicketButton: '[data-cy="add-price-free"] > span.v-btn__content',
        continuePriceButton: '[data-cy="price"] div:nth-of-type(6) > button.bg-primary > span.v-btn__content',
        continueSalesButton: '[data-cy="sales-info"] button.bg-primary > span.v-btn__content',
        continueMediaButton: 'div:nth-of-type(5) > button.bg-primary > span.v-btn__content',
        descriptionField: 'div.v-card div.v-card > div:nth-of-type(3) > div',
        publishButton: '[data-cy="event-form\\.publish"] > span.v-btn__content',
        confirmPublishButton: '[data-cy="button_Publier"] > span.v-btn__content'
    }
};

exports.handler = async (event) => {
    console.log('🎪 Version EVENTIM UNIQUEMENT - Test production');
    
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
        const eventData = JSON.parse(event.body);
        console.log('📝 Publication EVENTIM de:', eventData.title);

        // Valider les données
        if (!eventData.title || !eventData.date) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Données manquantes',
                    required: ['title', 'date']
                })
            };
        }

        // Formater les données
        const formattedData = {
            title: eventData.title,
            description: `${eventData.description || 'Événement organisé par Hormur'}

🎭 BILLETTERIE OFFICIELLE : HORMUR.COM 🎭
───────────────────────────────────────
⚠️ IMPORTANT : Les réservations faites ici sont des PRÉ-RÉSERVATIONS.
✅ Pour obtenir vos billets valables : ${eventData.eventUrl || 'https://hormur.com'}

📍 Cet événement se déroule dans un lieu atypique.
L'adresse exacte sera communiquée après réservation sur Hormur.com

💡 Hormur - Des expériences culturelles uniques dans des lieux insolites`,
            date: eventData.date,
            time: eventData.time || '20:00',
            venue: eventData.venue || 'Lieu à confirmer',
            address: eventData.address || 'Paris',
            imageUrl: eventData.imageUrl || '',
            eventUrl: eventData.eventUrl || 'https://hormur.com',
            category: eventData.category || 'Concert'
        };

        // Protection timeout (plus long pour une seule plateforme)
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: false,
                    platform: 'eventim',
                    error: 'Timeout de sécurité (45 secondes)'
                });
            }, 45000); // 45 secondes pour Eventim seul
        });

        // Publication EVENTIM uniquement
        const workPromise = publishToEventimComplete(formattedData);
        const eventimResult = await Promise.race([workPromise, timeoutPromise]);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: eventimResult.success,
                message: eventimResult.success 
                    ? 'Publication Eventim réussie !' 
                    : 'Échec publication Eventim',
                eventData: formattedData,
                results: {
                    eventim: eventimResult
                },
                debug: {
                    timestamp: new Date().toISOString(),
                    platform: 'eventim-only',
                    timeoutSeconds: 45
                }
            })
        };

    } catch (error) {
        console.error('💥 Erreur:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};

// === EVENTIM COMPLET ===
async function publishToEventimComplete(eventData) {
    console.log('🎪 [EVENTIM] Publication complète démarrée');
    let browser = null;
    
    try {
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-http2',
                '--disable-images', // Accélération
                '--disable-plugins'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            timeout: 20000
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
        });
        
        // 1. CONNEXION
        console.log('[EVENTIM] 🔐 Connexion...');
        await page.goto('https://www.eventim-light.com/fr/login?redirect=/events/create/common', { 
            waitUntil: 'networkidle0',
            timeout: 15000
        });
        
        // Gérer popup cookies
        try {
            await page.waitForSelector('#cmpclosebntnotxt', { timeout: 3000 });
            await page.click('#cmpclosebntnotxt');
            console.log('[EVENTIM] Cookies fermés');
        } catch (e) {
            console.log('[EVENTIM] Pas de popup cookies');
        }
        
        // Remplir identifiants
        await page.waitForSelector(SELECTORS.eventim.emailField, { timeout: 8000 });
        await page.type(SELECTORS.eventim.emailField, CREDENTIALS.eventim.email, { delay: 50 });
        console.log('[EVENTIM] Email saisi');
        
        await page.waitForSelector(SELECTORS.eventim.passwordField, { timeout: 5000 });
        await page.type(SELECTORS.eventim.passwordField, CREDENTIALS.eventim.password, { delay: 50 });
        console.log('[EVENTIM] Password saisi');
        
        // Se connecter
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
            page.click(SELECTORS.eventim.loginButton)
        ]);
        console.log('[EVENTIM] ✅ Connecté avec succès');
        
        // 2. CRÉATION D'ÉVÉNEMENT - Étape 1: Informations de base
        console.log('[EVENTIM] 📝 Remplissage nom événement...');
        await page.waitForSelector(SELECTORS.eventim.eventNameField, { timeout: 8000 });
        await page.type(SELECTORS.eventim.eventNameField, eventData.title, { delay: 50 });
        
        // Sélectionner catégorie "Concerts & Festivals"
        console.log('[EVENTIM] 🎵 Sélection catégorie...');
        await page.waitForSelector(SELECTORS.eventim.categoryDropdown, { timeout: 5000 });
        await page.click(SELECTORS.eventim.categoryDropdown);
        await page.waitForTimeout(1000);
        await page.click(SELECTORS.eventim.concertsOption);
        console.log('[EVENTIM] Catégorie sélectionnée');
        
        // Continuer vers l'étape suivante
        await page.waitForTimeout(1000);
        await page.click(SELECTORS.eventim.continueEventButton);
        console.log('[EVENTIM] ➡️ Étape événement validée');
        
        // 3. HORAIRES
        console.log('[EVENTIM] 📅 Configuration date/heure...');
        const formattedDateTime = `${eventData.date.split('-').reverse().join('/')} à ${eventData.time}`;
        await page.waitForSelector(SELECTORS.eventim.dateField, { timeout: 8000 });
        await page.type(SELECTORS.eventim.dateField, formattedDateTime, { delay: 100 });
        
        await page.waitForTimeout(1000);
        await page.click(SELECTORS.eventim.continueScheduleButton);
        console.log('[EVENTIM] ➡️ Horaires configurés');
        
        // 4. LIEU (Événement en ligne)
        console.log('[EVENTIM] 🌐 Configuration lieu (en ligne)...');
        await page.waitForTimeout(2000);
        await page.click(SELECTORS.eventim.onlineEventButton);
        await page.waitForTimeout(1000);
        await page.click(SELECTORS.eventim.continueVenueButton);
        console.log('[EVENTIM] ➡️ Lieu configuré');
        
        // 5. BILLETTERIE
        console.log('[EVENTIM] 🎫 Configuration billetterie...');
        await page.waitForSelector(SELECTORS.eventim.quotaField, { timeout: 8000 });
        await page.type(SELECTORS.eventim.quotaField, '50', { delay: 50 });
        
        await page.waitForTimeout(1000);
        await page.click(SELECTORS.eventim.continueTicketButton);
        console.log('[EVENTIM] ➡️ Quota configuré');
        
        // 6. TARIFICATION (Gratuit)
        console.log('[EVENTIM] 💰 Configuration tarification...');
        await page.waitForTimeout(2000);
        await page.click(SELECTORS.eventim.addFreeTicketButton);
        
        await page.waitForTimeout(2000);
        await page.click(SELECTORS.eventim.continuePriceButton);
        console.log('[EVENTIM] ➡️ Tarification configurée');
        
        // 7. INFORMATIONS DE VENTE
        console.log('[EVENTIM] 📊 Informations de vente...');
        await page.waitForTimeout(1000);
        await page.click(SELECTORS.eventim.continueSalesButton);
        console.log('[EVENTIM] ➡️ Infos vente validées');
        
        // 8. MÉDIAS (Ignorer pour le moment)
        console.log('[EVENTIM] 🖼️ Médias...');
        await page.waitForTimeout(1000);
        await page.click(SELECTORS.eventim.continueMediaButton);
        console.log('[EVENTIM] ➡️ Médias ignorés');
        
        // 9. DESCRIPTION
        console.log('[EVENTIM] 📄 Ajout description...');
        await page.waitForSelector(SELECTORS.eventim.descriptionField, { timeout: 8000 });
        await page.click(SELECTORS.eventim.descriptionField);
        await page.type(SELECTORS.eventim.descriptionField, eventData.description, { delay: 30 });
        console.log('[EVENTIM] Description ajoutée');
        
        // 10. PUBLICATION FINALE
        console.log('[EVENTIM] 🚀 Publication finale...');
        await page.waitForTimeout(2000);
        await page.click(SELECTORS.eventim.publishButton);
        
        // Confirmer la publication
        await page.waitForTimeout(3000);
        await page.click(SELECTORS.eventim.confirmPublishButton);
        
        // Attendre la confirmation
        await page.waitForTimeout(5000);
        
        console.log('✅ [EVENTIM] Publication complète réussie !');
        
        return {
            success: true,
            platform: 'eventim',
            message: `Événement "${eventData.title}" publié avec succès sur Eventim Light`,
            debug: {
                finalUrl: page.url(),
                steps: 'connexion → événement → horaires → lieu → billetterie → prix → vente → médias → description → publication'
            }
        };
        
    } catch (error) {
        console.error('❌ [EVENTIM] Erreur:', error.message);
        return {
            success: false,
            platform: 'eventim',
            error: error.message,
            debug: {
                step: 'unknown',
                url: browser ? await browser.pages().then(pages => pages[0]?.url()) : 'unknown'
            }
        };
    } finally {
        if (browser) {
            console.log('[EVENTIM] 🔒 Fermeture navigateur');
            await browser.close();
        }
    }
}
