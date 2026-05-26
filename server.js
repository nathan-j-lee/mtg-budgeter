import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

const TAGGER_GRAPHQL = 'https://tagger.scryfall.com/graphql';

async function getTaggerSession(set, number) {
    // Step 1: Load the card page to get a session cookie + CSRF token
    const pageUrl = `https://tagger.scryfall.com/card/${set}/${number}`;
    const pageRes = await fetch(pageUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });

    if (!pageRes.ok) throw new Error(`Tagger page load failed: ${pageRes.status}`);

    // Extract the session cookie from Set-Cookie headers
    const rawCookies = pageRes.headers.raw()['set-cookie'] ?? [];
    const sessionCookie = rawCookies
        .map(c => c.split(';')[0])
        .find(c => c.startsWith('_scryfall_tagger_session'));

    if (!sessionCookie) throw new Error('No session cookie returned from Tagger');

    // Extract CSRF token from the HTML meta tag
    const html = await pageRes.text();
    const csrfMatch = html.match(/<meta name="csrf-token" content="([^"]+)"/);
    if (!csrfMatch) throw new Error('Could not find CSRF token in Tagger page');

    const csrfToken = csrfMatch[1];
    return { sessionCookie, csrfToken };
}

app.get('/api/tags', async (req, res) => {
    const { set, number } = req.query;
    if (!set || !number) {
        return res.status(400).json({ error: 'Missing required params: set, number' });
    }

    try {
        // Step 1: Get session + CSRF token
        const { sessionCookie, csrfToken } = await getTaggerSession(set, number);

        // Step 2: Use them in the GraphQL request
        const TAGS_QUERY = `
            query FetchCard($set: String!, $number: String!, $back: Boolean = false) {
                card: cardBySet(set: $set, number: $number, back: $back) {
                    name
                    taggings {
                        tag {
                            name
                            slug
                            type
                        }
                    }
                }
            }
        `;

        const response = await fetch(TAGGER_GRAPHQL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://tagger.scryfall.com',
                'Referer': `https://tagger.scryfall.com/card/${set}/${number}`,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0',
                'X-CSRF-Token': csrfToken,
                'Cookie': sessionCookie,
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
            },
            body: JSON.stringify({
                operationName: 'FetchCard',
                query: TAGS_QUERY,
                variables: { set, number, back: false },
            }),
        });

        const raw = await response.text();
        console.log('Tagger status:', response.status);
        console.log('Tagger response:', raw);

        if (!response.ok) {
            return res.status(502).json({ error: 'Tagger request failed', status: response.status, body: raw });
        }

        const data = JSON.parse(raw);
        const taggings = data?.data?.card?.taggings ?? [];
        const tags = taggings.map(t => ({
            name: t.tag.name,
            slug: t.tag.slug,
            type: t.tag.type,
        }));

        res.json({ tags });

    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(3001, () => console.log('Server running on http://localhost:3001'));