async function test() {
  const res = await fetch('https://maps.app.goo.gl/dBny6HSUssx7r3rG8', { redirect: 'manual' });
  console.log(res.status);
  console.log(res.headers.get('location'));
}
test();
