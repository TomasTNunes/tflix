"""AdGuard DNS profile for Get Apps -> iPhone, iPad & Mac.

The site offers AdGuard's signed .mobileconfig (AdGuard DNS, default ad-blocking
servers, DNS-over-HTTPS) at assets/adguard/adguard-dns.mobileconfig. Its signing
certificate expires, and a profile signed with an expired one installs as
"Not Verified", so the copy is kept fresh:

  pick <file>   (Deploy Website) Gathers up to three copies: a fresh one from
                AdGuard, the one live on tflix.stream and <file> from the repo.
                Keeps the valid one that expires latest and writes it to <file>.
                Never fails: if none is valid, <file> stays as it is.
  check         (AdGuard Profile Check, monthly) If the live copy has 30 days
                or more left, nothing to do. Otherwise asks AdGuard for a fresh
                one and sets renew=true when it expires later, so the workflow
                runs Deploy Website; fails (GitHub emails the owner) if it can't.

Valid means: signed with an unbroken certificate chain by an AdGuard
certificate, and a DNS-over-HTTPS profile for https://dns.adguard-dns.com/dns-query.
"""

import datetime as dt
import json
import os
import plistlib
import subprocess
import sys
import tempfile
import urllib.request

API = 'https://adguard-dns.io/public_api/v1/dns/mobile_config'
ORIGIN = 'https://adguard-dns.io'
LIVE = 'https://tflix.stream/assets/adguard/adguard-dns.mobileconfig'
SERVER_URL = 'https://dns.adguard-dns.com/dns-query'
RENEW_DAYS = 30
HEADERS = {'User-Agent': 'tflix-deploy'}
CA_FILES = [os.environ.get('SSL_CERT_FILE') or '', '/etc/ssl/certs/ca-certificates.crt']


def fetch(url, data=None):
    headers = dict(HEADERS, **({'Content-Type': 'application/json'} if data else {}))
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def fetch_fresh():
    body = json.dumps({'dns_proto_type': 'DOH', 'filtering_type': 'DEFAULT'}).encode()
    link = json.loads(fetch(API, body))['download_link']
    return fetch(ORIGIN + link)


def inspect(data):
    """-> expiry (UTC datetime) of a valid profile; raises ValueError otherwise."""
    ca = next((f for f in CA_FILES if os.path.exists(f)), None)
    if not ca:
        raise ValueError('no CA bundle found')
    with tempfile.TemporaryDirectory() as tmp:
        src, signer, payload = (os.path.join(tmp, n) for n in ('p.mobileconfig', 'signer.pem', 'payload.xml'))
        with open(src, 'wb') as f:
            f.write(data)
        # Checks the signature and the chain, but not the dates: an expired
        # profile is still worth keeping when it's the only one there is
        r = subprocess.run(['openssl', 'smime', '-verify', '-inform', 'DER', '-in', src, '-purpose', 'any',
                            '-no_check_time', '-CAfile', ca, '-signer', signer, '-out', payload],
                           capture_output=True, text=True)
        if r.returncode != 0:
            raise ValueError('signature does not verify: ' + r.stderr.strip().splitlines()[-1] if r.stderr.strip() else 'signature does not verify')
        cert = subprocess.run(['openssl', 'x509', '-in', signer, '-noout', '-subject', '-enddate'],
                              capture_output=True, text=True, check=True).stdout
        with open(payload, 'rb') as f:
            plist = plistlib.load(f)

    subject = next(l for l in cert.splitlines() if l.startswith('subject='))
    if 'adguard' not in subject.lower():
        raise ValueError('not signed by AdGuard: ' + subject)
    dns = [p.get('DNSSettings', {}) for p in plist.get('PayloadContent', [])
           if p.get('PayloadType') == 'com.apple.dnsSettings.managed']
    if not any(d.get('ServerURL') == SERVER_URL and d.get('DNSProtocol') == 'HTTPS' for d in dns):
        raise ValueError('not the AdGuard DNS (default, DNS-over-HTTPS) profile')
    end = next(l for l in cert.splitlines() if l.startswith('notAfter=')).split('=', 1)[1]
    return dt.datetime.strptime(' '.join(end.split()), '%b %d %H:%M:%S %Y GMT').replace(tzinfo=dt.timezone.utc)


def now():
    return dt.datetime.now(dt.timezone.utc)


def summary(lines):
    print('\n'.join(lines))
    path = os.environ.get('GITHUB_STEP_SUMMARY')
    if path:
        with open(path, 'a', encoding='utf-8') as f:
            f.write('\n'.join(['### AdGuard DNS profile', '', *lines, '']))


def output(key, value):
    path = os.environ.get('GITHUB_OUTPUT')
    if path:
        with open(path, 'a', encoding='utf-8') as f:
            f.write(f'{key}={value}\n')


def pick(path):
    sources = [('AdGuard (fresh)', fetch_fresh), ('tflix.stream (live)', lambda: fetch(LIVE)),
               ('repo', lambda: open(path, 'rb').read())]
    found, lines = [], []
    for name, get in sources:
        try:
            data = get()
            expiry = inspect(data)
            found.append((expiry, name, data))
            lines.append(f'- {name}: valid until {expiry:%Y-%m-%d}' + (' (expired)' if expiry < now() else ''))
        except Exception as e:
            lines.append(f'- {name}: not used ({e})')

    if not found:
        lines.append('\nNo valid profile found: the repo copy is deployed as it is.')
        print('::warning::AdGuard DNS profile: no valid copy found, the repo copy is deployed as it is')
        return summary(lines)

    expiry, name, data = max(found, key=lambda c: c[0])
    with open(path, 'wb') as f:
        f.write(data)
    lines.append(f'\nDeployed: **{name}**, valid until {expiry:%Y-%m-%d}.')
    if not name.startswith('AdGuard'):
        print(f'::warning::AdGuard DNS profile: no fresh copy from AdGuard, deployed the {name} one (valid until {expiry:%Y-%m-%d})')
    if expiry < now():
        print('::warning::AdGuard DNS profile: the deployed copy has expired and installs as Not Verified')
    summary(lines)


def check():
    try:
        live = inspect(fetch(LIVE))
    except Exception as e:
        live = None
        print(f'Live profile unusable: {e}')
    if live and (live - now()).days >= RENEW_DAYS:
        output('renew', 'false')
        return summary([f'Live profile is valid until {live:%Y-%m-%d}, {(live - now()).days} days left. Nothing to do.'])

    left = f'valid until {live:%Y-%m-%d}' if live else 'missing or invalid'
    try:
        fresh = inspect(fetch_fresh())
    except Exception as e:
        summary([f'Live profile is {left}, and AdGuard did not give a valid new one: {e}'])
        print('::error::AdGuard DNS profile needs renewing, but AdGuard did not give a valid new one')
        sys.exit(1)
    if live and fresh <= live:
        summary([f'Live profile is {left}, and AdGuard\'s newest is no better (valid until {fresh:%Y-%m-%d}).'])
        print('::error::AdGuard DNS profile needs renewing, but AdGuard has no newer one yet')
        sys.exit(1)
    output('renew', 'true')
    summary([f'Live profile is {left}. AdGuard has one valid until {fresh:%Y-%m-%d}: deploying it.'])


if __name__ == '__main__':
    if sys.argv[1:2] == ['pick'] and len(sys.argv) == 3:
        pick(sys.argv[2])
    elif sys.argv[1:] == ['check']:
        check()
    else:
        sys.exit('usage: adguard_profile.py pick <file> | check')
