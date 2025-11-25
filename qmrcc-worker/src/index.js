export default {
  async fetch(request) {
    const url = new URL(request.url);
    const baserowEndpoint = url.searchParams.get("endpoint");

    if (!baserowEndpoint) {
      return new Response("Missing endpoint parameter", { status: 400 });
    }

    // Base Baserow URL — adjust table ID if needed
    const baserowUrl = `https://api.baserow.io/api/${baserowEndpoint}`;

    try {
      const response = await fetch(baserowUrl, {
        headers: {
          Authorization: `Token ${qxpA0w4kzkN9KeLhRhrgPtNLRjrQv8sF}`,
        }
      });

      const data = await response.text();
      return new Response(data, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type"),
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (err) {
      return new Response("Proxy Error: " + err.toString(), { status: 500 });
    }
  }
}
