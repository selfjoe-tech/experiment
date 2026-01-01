// app/watch/[id]/head.tsx
export default function Head({ params }: { params: { id: string } }) {
  const site =
    (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");

  const canonical = `${site}/watch/${params.id}`;
  const oembedUrl = `${site}/api/oembed?format=json&url=${encodeURIComponent(canonical)}`;

  return (
    <>
      <link rel="canonical" href={canonical} />
      <meta name="robots" content="index,follow" />
      <meta name="googlebot" content="index,follow" />

      {/* oEmbed discovery for Reddit */}
      <link
        rel="alternate"
        type="application/json+oembed"
        href={oembedUrl}
        title="UpskirtCandy oEmbed"
      />

      {/* Only add this if your endpoint actually supports format=xml */}
      {/* <link
        rel="alternate"
        type="text/xml+oembed"
        href={`${site}/api/oembed?format=xml&url=${encodeURIComponent(canonical)}`}
        title="UpskirtCandy oEmbed"
      /> */}
    </>
  );
}
