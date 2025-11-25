export default {
  async fetch(request, env) {
    return new Response("Cloudflare Worker running!", {
      status: 200
    });
  }
}
