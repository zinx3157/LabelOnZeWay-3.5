export function createServices({ store }) {
  const lifecycle = {
    async start() {
      store.setState({ sync: { status: 'idle', conflict: false } });
    },
  };

  const unsupported = (name) => ({
    async start() { return { status: 'not-configured', service: name }; },
  });

  return {
    lifecycle,
    auth: unsupported('auth'),
    sync: unsupported('sync'),
    supabase: unsupported('supabase'),
    print: unsupported('print'),
    ocr: unsupported('ocr'),
    messaging: unsupported('messaging'),
  };
}
