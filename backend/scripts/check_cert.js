const tls = require('tls');

async function getCert(host, port = 443) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(port, host, { servername: host, rejectUnauthorized: false }, () => {
      try {
        const cert = socket.getPeerCertificate(true);
        if (!cert || Object.keys(cert).length === 0) {
          reject(new Error('No certificate returned'));
          socket.end();
          return;
        }

        resolve({
          subject: cert.subject || {},
          issuer: cert.issuer || {},
          valid_from: cert.valid_from,
          valid_to: cert.valid_to,
          fingerprint: cert.fingerprint,
          fingerprint256: cert.fingerprint256,
        });
      } catch (err) {
        reject(err);
      } finally {
        socket.end();
      }
    });

    socket.on('error', (err) => reject(err));
  });
}

(async () => {
  const hosts = process.argv.slice(2);
  if (!hosts.length) {
    console.error('Usage: node check_cert.js <host1> [host2 ...]');
    process.exit(1);
  }

  for (const h of hosts) {
    try {
      const info = await getCert(h);
      console.log(`\nCertificate for ${h}:`);
      console.log(' Subject CN:', info.subject.CN || info.subject.commonName || '(n/a)');
      console.log(' Issuer CN :', info.issuer.CN || info.issuer.commonName || '(n/a)');
      console.log(' Valid from:', info.valid_from);
      console.log(' Valid to  :', info.valid_to);
      console.log(' Fingerprint (SHA1):', info.fingerprint || '(n/a)');
      console.log(' Fingerprint (SHA256):', info.fingerprint256 || '(n/a)');
    } catch (err) {
      console.error(`\nFailed to fetch cert for ${h}:`, err.message || err);
    }
  }
})();
