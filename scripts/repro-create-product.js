const base = process.env.BASE_URL || 'http://127.0.0.1:3001';

async function main() {
  const email = process.env.EMAIL || 'merchant1@shop.com';
  const password = process.env.PASSWORD || '123456';

  const loginRes = await fetch(base + '/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const loginText = await loginRes.text();
  console.log('login', loginRes.status, loginText);
  if (!loginRes.ok) return;

  const login = JSON.parse(loginText);
  const token = login.token;
  const userId = (login.user && (login.user._id || login.user.id)) || '';

  const fd = new FormData();
  fd.set('name', 'Test Product ' + Date.now());
  fd.set('price', '19.99');
  fd.set('category', 'test');
  fd.set('description', 'desc');
  fd.set('stock', '10');
  fd.set('merchant', userId);

  const createRes = await fetch(base + '/api/products', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token },
    body: fd,
  });

  const createText = await createRes.text();
  console.log('create', createRes.status, createText);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
