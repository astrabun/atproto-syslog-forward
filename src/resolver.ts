import {
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  LocalActorResolver,
  CompositeHandleResolver,
  DohJsonHandleResolver,
  WellKnownHandleResolver,
} from '@atcute/identity-resolver';

export const handleResolver = new CompositeHandleResolver({
  methods: {
    dns: new DohJsonHandleResolver({
      dohUrl: 'https://mozilla.cloudflare-dns.com/dns-query',
    }),
    http: new WellKnownHandleResolver(),
  },
});

export const didResolver = new CompositeDidDocumentResolver({
  methods: {
    plc: new PlcDidDocumentResolver(),
    web: new WebDidDocumentResolver(),
  },
});

export const actorResolver = new LocalActorResolver({
  didDocumentResolver: didResolver,
  handleResolver,
});
