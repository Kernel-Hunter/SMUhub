/**
 * Serving the built web app next to the API (production). No database needed: these routes never touch it.
 *   npm test
 */
import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'

const THEME = "document.documentElement.classList.add('dark')"
const dir = mkdtempSync(path.join(tmpdir(), 'smuhub-web-'))
mkdirSync(path.join(dir, 'assets'))
writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html><head><script>${THEME}</script></head><body><div id="root"></div><script type="module" src="/assets/app-1a2b.js"></script></body></html>`)
writeFileSync(path.join(dir, 'assets', 'app-1a2b.js'), 'console.log(1)')
writeFileSync(path.join(dir, 'favicon-32.png'), 'png')

const base = { NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1:27017/unused', JWT_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing', ALLOWED_EMAIL_DOMAINS: 'medtech.tn' }
const app = createApp(loadConfig({ ...base, CLIENT_DIST: dir }))

after(() => rmSync(dir, { recursive: true, force: true }))

describe('built web app', () => {
  it('answers client routes with the app shell, never cached', async () => {
    for (const url of ['/', '/questions/123', '/login']) {
      const res = await request(app).get(url)
      assert.equal(res.status, 200)
      assert.match(res.headers['content-type'], /text\/html/)
      assert.match(res.text, /<div id="root">/)
      assert.equal(res.headers['cache-control'], 'no-cache')
    }
  })

  it('allows the inline theme script by hash and nothing else inline', async () => {
    const csp = (await request(app).get('/')).headers['content-security-policy']
    const hash = createHash('sha256').update(THEME).digest('base64')
    assert.ok(csp.includes(`script-src 'self' 'sha256-${hash}'`), csp)
    assert.ok(!/script-src[^;]*unsafe-inline/.test(csp), csp)
  })

  it('caches fingerprinted assets for a year and serves other files', async () => {
    const asset = await request(app).get('/assets/app-1a2b.js')
    assert.equal(asset.status, 200)
    assert.match(asset.headers['cache-control'], /max-age=31536000.*immutable/)
    assert.equal((await request(app).get('/favicon-32.png')).status, 200)
  })

  it('keeps unknown API paths as JSON 404s', async () => {
    for (const url of ['/api', '/api/nope']) {
      const res = await request(app).get(url)
      assert.equal(res.status, 404)
      assert.ok(res.body.error, `${url} should answer the JSON error shape`)
    }
  })

  it('serves no web app when none is configured outside production', async () => {
    const apiOnly = createApp(loadConfig(base))
    assert.equal((await request(apiOnly).get('/')).status, 404)
  })
})
