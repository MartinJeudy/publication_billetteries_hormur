// netlify/functions/publish-event.js - VERSION AVEC ATTENTE CHAMPS DYNAMIQUES
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const CREDENTIALS = {
    eventim: {
        email: process.env.EVENTIM_EMAIL,
        password: process.env.EVENTIM_PASSWORD
    }
};

exports.handler = async (event) => {
    console.log('🚀 Version avec attente des champs dynamiques');
    
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
        console.log('📝 Test pour:', eventData.title);

        // PROTECTION TIMEOUT: 25 secondes max (limite Netlify = 26s)
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: false,
                    platform: 'eventim',
                    error: 'Timeout de sécurité (25 secondes)',
                    message: 'Fonction interrompue pour éviter timeout Netlify'
                });
            }, 25000);
        });

        const workPromise = smartEventimTest();

        // Course entre le travail et le timeout
        const eventimResult = await Promise.race([workPromise, timeoutPromise]);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: eventimResult.success,
                message: 'Test avec attente des champs terminé',
                eventTitle: eventData.title,
                results: {
                    eventim: eventimResult
                },
                debug: {
                    timestamp: new Date().toISOString(),
                    protectedByTimeout: true
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
                error: error.message,
                type: 'caught_error'
            })
        };
    }
};

async function smartEventimTest() {
    console.log('🧠 Test Eventim intelligent avec attente des champs');
    let browser = null;
    
    try {
        console.log('🚀 Lancement navigateur...');
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-http2',
                '--disable-web-security'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            timeout: 15000
        });

        const page = await browser.newPage();
        console.log('📄 Page créée');
        
        // Configuration
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
        });
        
        // Navigation vers login
        console.log('🔐 Navigation vers login...');
        await page.goto('https://www.eventim-light.com/fr/login', { 
            waitUntil: 'networkidle0', // Attendre que le réseau soit inactif
            timeout: 15000
        });
        
        console.log('⏱️ Attente du chargement complet des champs...');
        
        // Attendre que les champs apparaissent (avec retry)
        let passwordField = null;
        let emailField = null;
        let attempt = 0;
        const maxAttempts = 10;
        
        while (attempt < maxAttempts && (!passwordField || !emailField)) {
            attempt++;
            console.log(`🔍 Tentative ${attempt}/${maxAttempts} de détection des champs...`);
            
            // Attendre un peu
            await page.waitForTimeout(1000);
            
            // Chercher le champ password
            passwordField = await page.$('input[type="password"]');
            
            // Chercher le champ email avec plusieurs sélecteurs
            const emailSelectors = [
                'input[type="email"]',
                'input[name="email"]',
                'input[name="username"]',
                'input:not([type="password"]):not([type="submit"]):not([type="button"])',
                '.v-text-field input'
            ];
            
            for (const selector of emailSelectors) {
                try {
                    emailField = await page.$(selector);
                    if (emailField) break;
                } catch (e) {
                    // Ignorer
                }
            }
            
            if (passwordField && emailField) {
                console.log(`✅ Champs trouvés à la tentative ${attempt} !`);
                break;
            }
        }
        
        // Debug: compter tous les inputs après attente
        const allInputs = await page.$$eval('input', inputs => 
            inputs.map(input => ({
                type: input.type,
                name: input.name,
                placeholder: input.placeholder,
                visible: input.offsetParent !== null
            }))
        );
        
        console.log(`📊 Après attente: ${allInputs.length} inputs trouvés`);
        
        if (!passwordField || !emailField) {
            return {
                success: false,
                platform: 'eventim',
                error: 'Champs non trouvés après 10 tentatives',
                debug: {
                    attempts: attempt,
                    allInputs: allInputs,
                    hasPassword: !!passwordField,
                    hasEmail: !!emailField,
                    url: page.url(),
                    title: await page.title()
                }
            };
        }
        
        // TENTATIVE DE CONNEXION RAPIDE
        console.log('🔥 Tentative de connexion rapide...');
        
        try {
            // Remplir email
            await emailField.click();
            await page.waitForTimeout(300);
            await emailField.type(CREDENTIALS.eventim.email, { delay: 50 });
            console.log('✅ Email saisi');
            
            // Remplir password
            await passwordField.click();
            await page.waitForTimeout(300);
            await passwordField.type(CREDENTIALS.eventim.password, { delay: 50 });
            console.log('✅ Password saisi');
            
            // Chercher et cliquer le bouton
            let loginButton = null;
            
            // Chercher avec XPath
            const buttons = await page.$x('//button[contains(text(), "Connexion")]');
            if (buttons.length > 0) {
                loginButton = buttons[0];
            } else {
                // Fallback: premier button submit
                loginButton = await page.$('button[type="submit"]');
            }
            
            if (loginButton) {
                console.log('🔘 Clic sur bouton connexion...');
                
                // Cliquer et attendre (avec timeout court)
                await Promise.race([
                    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }),
                    loginButton.click()
                ]);
                
                // Vérifier le résultat
                await page.waitForTimeout(2000);
                const finalUrl = page.url();
                const finalTitle = await page.title();
                
                console.log(`🎯 Après connexion: ${finalUrl}`);
                
                if (finalUrl.includes('login')) {
                    return {
                        success: false,
                        platform: 'eventim',
                        error: 'Connexion échouée - encore sur login',
                        debug: { finalUrl, finalTitle }
                    };
                }
                
                return {
                    success: true,
                    platform: 'eventim',
                    message: 'Connexion Eventim réussie !',
                    debug: {
                        finalUrl: finalUrl,
                        finalTitle: finalTitle,
                        inputsFound: allInputs.length,
                        attemptsNeeded: attempt
                    }
                };
                
            } else {
                return {
                    success: false,
                    platform: 'eventim',
                    error: 'Bouton connexion non trouvé'
                };
            }
            
        } catch (loginError) {
            return {
                success: false,
                platform: 'eventim',
                error: `Erreur lors de la connexion: ${loginError.message}`,
                debug: {
                    loginError: loginError.message,
                    inputsFound: allInputs.length
                }
            };
        }
        
    } catch (error) {
        console.error('❌ Erreur test intelligent:', error.message);
        return {
            success: false,
            platform: 'eventim',
            error: error.message
        };
    } finally {
        if (browser) {
            console.log('🔒 Fermeture navigateur...');
            try {
                await browser.close();
            } catch (e) {
                console.log('⚠️ Erreur fermeture:', e.message);
            }
        }
    }
}
