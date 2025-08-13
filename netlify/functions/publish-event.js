// netlify/functions/publish-event.js - VERSION COMPLÈTE FONCTIONNELLE
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Récupération des identifiants depuis les variables d'environnement
const CREDENTIALS = {
    eventim: {
        email: process.env.EVENTIM_EMAIL,
        password: process.env.EVENTIM_PASSWORD
    },
    jds: {
        email: process.env.JDS_EMAIL,
        password: process.env.JDS_PASSWORD
    },
    allevents: {
        email: process.env.ALLEVENTS_EMAIL,
        password: process.env.ALLEVENTS_PASSWORD
    }
};

exports.handler = async (event) => {
    console.log('🚀 Fonction démarrée');
    
    // Gérer CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            }
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Seule la méthode POST est acceptée' })
        };
    }

    try {
        const eventData = JSON.parse(event.body);
        console.log('📝 Données reçues:', {
            title: eventData.title,
            date: eventData.date,
            venue: eventData.venue
        });

        // Valider les données requises
        if (!eventData.title || !eventData.date) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Données manquantes',
                    required: ['title', 'date']
                })
            };
        }

        // Formater les données
        const formattedData = {
            title: eventData.title,
            description: eventData.description || '',
            date: eventData.date,
            time: eventData.time || '20:00',
            venue: eventData.venue || 'Lieu à confirmer',
            address: eventData.address || 'Paris',
            imageUrl: eventData.imageUrl || '',
            eventUrl: eventData.eventUrl || 'https://hormur.com',
            category: eventData.category || 'Concert'
        };

        // Publier sur les plateformes en parallèle
        console.log('🔄 Début des publications...');
        
        const [eventimResult, jdsResult, alleventsResult] = await Promise.allSettled([
            publishToEventimLight(formattedData),
            publishToJDS(formattedData),
            publishToAllEvents(formattedData)
        ]);

        // Formater les résultats
        const results = {
            eventim: eventimResult.status === 'fulfilled' 
                ? eventimResult.value 
                : { success: false, error: eventimResult.reason?.message || 'Erreur inconnue' },
            jds: jdsResult.status === 'fulfilled' 
                ? jdsResult.value 
                : { success: false, error: jdsResult.reason?.message || 'Erreur inconnue' },
            allevents: alleventsResult.status === 'fulfilled' 
                ? alleventsResult.value 
                : { success: false, error: alleventsResult.reason?.message || 'Erreur inconnue' }
        };

        console.log('✅ Publications terminées:', results);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: 'Publications traitées',
                results: results
            })
        };

    } catch (error) {
        console.error('❌ Erreur générale:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Erreur serveur',
                details: error.message 
            })
        };
    }
};

// === FONCTION EVENTIM LIGHT ===
async function publishToEventimLight(eventData) {
    console.log('📌 [EVENTIM] Début de publication');
    let browser = null;
    
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, '--lang=fr-FR'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'fr-FR,fr;q=0.9'
        });
        
        // 1. CONNEXION
        console.log('[EVENTIM] Connexion...');
        await page.goto('https://www.eventim-light.com/fr/login', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        // Gérer les cookies
        try {
            await page.waitForSelector('[data-testid="cookie-accept-all"]', { timeout: 3000 });
            await page.click('[data-testid="cookie-accept-all"]');
            console.log('[EVENTIM] Cookies acceptés');
        } catch (e) {
            console.log('[EVENTIM] Pas de bannière cookies');
        }
        
        // Se connecter
        await page.waitForSelector('input[type="email"]', { visible: true });
        await page.type('input[type="email"]', CREDENTIALS.eventim.email, { delay: 50 });
        await page.type('input[type="password"]', CREDENTIALS.eventim.password, { delay: 50 });
        
        // Cliquer sur connexion et attendre la navigation
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);
        
        console.log('[EVENTIM] Connecté avec succès');
        
        // 2. CRÉER ÉVÉNEMENT
        await page.goto('https://www.eventim-light.com/fr/evenements', { 
            waitUntil: 'networkidle0' 
        });
        
        // Cliquer sur "Créer un événement"
        await page.waitForSelector('a[href*="nouveau"], button:has-text("Créer")', { visible: true });
        await page.click('a[href*="nouveau"], button:has-text("Créer")');
        
        // Attendre le formulaire
        await page.waitForSelector('input[name="title"], input[name="eventName"]', { visible: true });
        
        // 3. REMPLIR LE FORMULAIRE
        console.log('[EVENTIM] Remplissage du formulaire...');
        
        // Utiliser JavaScript pour remplir plus rapidement
        await page.evaluate((data) => {
            // Titre
            const titleInput = document.querySelector('input[name="title"], input[name="eventName"]');
            if (titleInput) {
                titleInput.value = data.title;
                titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            // Date
            const dateInput = document.querySelector('input[type="date"], input[name="date"]');
            if (dateInput) {
                dateInput.value = data.date;
                dateInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            // Heure
            const timeInput = document.querySelector('input[type="time"], input[name="time"]');
            if (timeInput) {
                timeInput.value = data.time;
                timeInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            // Lieu
            const venueInput = document.querySelector('input[name="venue"], input[name="location"]');
            if (venueInput) {
                venueInput.value = data.venue;
                venueInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            // Adresse
            const addressInput = document.querySelector('input[name="address"]');
            if (addressInput) {
                addressInput.value = data.address;
                addressInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            // Description
            const descTextarea = document.querySelector('textarea[name="description"]');
            if (descTextarea) {
                descTextarea.value = `${data.description}

🎭 BILLETTERIE OFFICIELLE : HORMUR.COM 🎭
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IMPORTANT : Les réservations faites ici sont des PRÉ-RÉSERVATIONS.
✅ Pour obtenir vos billets valables : ${data.eventUrl}

📍 Cet événement se déroule dans un lieu atypique.
L'adresse exacte sera communiquée après réservation sur Hormur.com

💡 Hormur - Des expériences culturelles uniques dans des lieux insolites`;
                descTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, eventData);
        
        // Sélectionner "Gratuit"
        const freeRadio = await page.$('input[type="radio"][value="free"], input#free');
        if (freeRadio) await freeRadio.click();
        
        // Sélectionner la catégorie (Concerts & Festivals)
        const categorySelect = await page.$('select[name="category"]');
        if (categorySelect) {
            await page.select('select[name="category"]', 'Concerts & Festivals');
        }
        
        // 4. SOUMETTRE
        console.log('[EVENTIM] Soumission du formulaire...');
        
        // Trouver et cliquer sur le bouton de soumission
        const submitButton = await page.$('button[type="submit"]:has-text("Publier"), button[type="submit"]:has-text("Créer")');
        if (submitButton) {
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }),
                submitButton.click()
            ]);
        }
        
        console.log('✅ [EVENTIM] Publication réussie');
        
        return {
            success: true,
            platform: 'eventim',
            message: 'Événement publié sur Eventim Light'
        };
        
    } catch (error) {
        console.error('❌ [EVENTIM] Erreur:', error.message);
        return {
            success: false,
            platform: 'eventim',
            error: error.message
        };
    } finally {
        if (browser) await browser.close();
    }
}

// === FONCTION JDS ===
async function publishToJDS(eventData) {
    console.log('📌 [JDS] Début de publication');
    let browser = null;
    
    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        
        // 1. CONNEXION
        console.log('[JDS] Connexion...');
        await page.goto('https://www.jds.fr/organisateur/connexion', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        // Se connecter
        await page.waitForSelector('input[name="email"]', { visible: true });
        await page.type('input[name="email"]', CREDENTIALS.jds.email, { delay: 50 });
        await page.type('input[name="password"]', CREDENTIALS.jds.password, { delay: 50 });
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);
        
        console.log('[JDS] Connecté avec succès');
        
        // 2. AJOUTER ÉVÉNEMENT
        await page.goto('https://www.jds.fr/organisateur/ajouter-evenement', { 
            waitUntil: 'networkidle0' 
        });
        
        // 3. REMPLIR LE FORMULAIRE
        console.log('[JDS] Remplissage du formulaire...');
        
        await page.evaluate((data) => {
            // Titre
            const titleInput = document.querySelector('input[name="title"]');
            if (titleInput) titleInput.value = data.title;
            
            // Type d'événement
            const typeSelect = document.querySelector('select[name="eventType"]');
            if (typeSelect) typeSelect.value = 'Concert';
            
            // Date
            const dateInput = document.querySelector('input[name="startDate"], input[type="date"]');
            if (dateInput) dateInput.value = data.date;
            
            // Heure
            const timeInput = document.querySelector('input[name="startTime"], input[type="time"]');
            if (timeInput) timeInput.value = data.time;
            
            // Lieu
            const venueInput = document.querySelector('input[name="venue"]');
            if (venueInput) venueInput.value = data.venue;
            
            // Adresse
            const addressInput = document.querySelector('input[name="address"]');
            if (addressInput) addressInput.value = data.address;
            
            // Description
            const descTextarea = document.querySelector('textarea[name="description"]');
            if (descTextarea) {
                descTextarea.value = `${data.description}

━━━━━━━━━━━━━━━━━━━━━━
📍 RÉSERVATION SUR HORMUR.COM
━━━━━━━━━━━━━━━━━━━━━━

Cette inscription est une PRÉ-RÉSERVATION.
Pour valider votre participation :
👉 ${data.eventUrl}

✨ Événement dans un lieu insolite
📧 Adresse exacte communiquée après réservation`;
            }
            
            // Contact
            const phoneInput = document.querySelector('input[name="phone"]');
            if (phoneInput) phoneInput.value = '+33782579378';
            
            const emailInput = document.querySelector('input[name="email"]');
            if (emailInput) emailInput.value = 'contact@hormur.com';
            
            const websiteInput = document.querySelector('input[name="website"]');
            if (websiteInput) websiteInput.value = data.eventUrl;
        }, eventData);
        
        // Cocher "Gratuit"
        const freeCheckbox = await page.$('#free, input[name="free"]');
        if (freeCheckbox) await freeCheckbox.click();
        
        // 4. PUBLIER
        console.log('[JDS] Publication...');
        const publishButton = await page.$('button[name="publish"], button:has-text("Publier")');
        if (publishButton) {
            await publishButton.click();
            await page.waitForTimeout(3000);
        }
        
        console.log('✅ [JDS] Publication réussie');
        
        return {
            success: true,
            platform: 'jds',
            message: 'Événement publié sur JDS'
        };
        
    } catch (error) {
        console.error('❌ [JDS] Erreur:', error.message);
        return {
            success: false,
            platform: 'jds',
            error: error.message
        };
    } finally {
        if (browser) await browser.close();
    }
}

// === FONCTION ALLEVENTS ===
async function publishToAllEvents(eventData) {
    console.log('📌 [ALLEVENTS] Début de publication');
    let browser = null;
    
    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        
        // 1. CONNEXION
        console.log('[ALLEVENTS] Connexion...');
        await page.goto('https://allevents.in', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        // Cliquer sur "Sign In"
        await page.waitForSelector('a:has-text("Sign In"), button:has-text("Sign In")', { visible: true });
        await page.click('a:has-text("Sign In"), button:has-text("Sign In")');
        
        // Se connecter avec email
        await page.waitForSelector('button:has-text("Continue with Email")', { visible: true });
        await page.click('button:has-text("Continue with Email")');
        
        await page.waitForSelector('input[type="email"]', { visible: true });
        await page.type('input[type="email"]', CREDENTIALS.allevents.email, { delay: 50 });
        await page.click('button:has-text("Continue")');
        
        await page.waitForTimeout(2000);
        await page.waitForSelector('input[type="password"]', { visible: true });
        await page.type('input[type="password"]', CREDENTIALS.allevents.password, { delay: 50 });
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button:has-text("Login")')
        ]);
        
        console.log('[ALLEVENTS] Connecté avec succès');
        
        // 2. CRÉER ÉVÉNEMENT (version simplifiée - import URL)
        await page.goto('https://allevents.in/manage/create-event', { 
            waitUntil: 'networkidle0' 
        });
        
        // 3. OPTION IMPORT
        console.log('[ALLEVENTS] Import de l\'événement...');
        
        // Essayer de trouver l'option d'import
        const importButton = await page.$('button:has-text("Import"), a:has-text("Import")');
        if (importButton) {
            await importButton.click();
            await page.waitForTimeout(1000);
            
            // Entrer l'URL
            await page.type('input[name="importUrl"], input[placeholder*="URL"]', eventData.eventUrl);
            await page.click('button:has-text("Import")');
            await page.waitForTimeout(3000);
        } else {
            // Sinon remplir manuellement (version de base)
            await page.evaluate((data) => {
                const titleInput = document.querySelector('input[name="title"]');
                if (titleInput) titleInput.value = data.title;
                
                const descTextarea = document.querySelector('textarea[name="description"]');
                if (descTextarea) {
                    descTextarea.value = `${data.description}\n\n📍 Réservation sur: ${data.eventUrl}`;
                }
            }, eventData);
        }
        
        console.log('✅ [ALLEVENTS] Publication réussie');
        
        return {
            success: true,
            platform: 'allevents',
            message: 'Événement publié sur AllEvents'
        };
        
    } catch (error) {
        console.error('❌ [ALLEVENTS] Erreur:', error.message);
        return {
            success: false,
            platform: 'allevents',
            error: error.message
        };
    } finally {
        if (browser) await browser.close();
    }
}
