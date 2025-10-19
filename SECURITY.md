# Security Policy

## Known Vulnerabilities

### webpack-dev-server (Development Only)

**Status:** Acknowledged - Not Fixed  
**Severity:** High (Development Only)  
**CVE:** Affects webpack-dev-server < 5.2.1  
**Impact:** Source code may be stolen when accessing malicious websites with non-Chromium browsers

#### Why Not Fixed?

1. **Production Not Affected:** This vulnerability ONLY affects development mode (`npm start`)
2. **Compatibility Issues:** Upgrading webpack-dev-server to 5.2.1+ breaks compatibility with react-scripts 5.0.1
3. **Mitigation:** Production builds (`npm run build`) do NOT include webpack-dev-server

#### Risk Assessment

- **Production Risk:** ✅ NONE - webpack-dev-server is not included in production builds
- **Development Risk:** ⚠️ LOW - Only affects developers running `npm start` while browsing malicious sites

#### Mitigation Strategies

For developers:
1. Use Chromium-based browsers (Chrome, Edge, Brave) for development
2. Avoid browsing untrusted websites while running development server
3. Use separate browser profiles for development
4. Run development server on localhost only (default)

#### Future Resolution

This will be resolved when:
- react-scripts is upgraded to v6+ (which supports webpack-dev-server 5.x)
- Or when ejecting from create-react-app

## Production Security

✅ **Production builds are secure** - Run `npm audit --production` to verify zero vulnerabilities in production dependencies.

## Reporting Security Issues

If you discover a security vulnerability, please email: security@example.com
