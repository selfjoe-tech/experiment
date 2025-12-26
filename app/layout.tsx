import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_NAME = "Upskirt Candy";
const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");
const DEFAULT_TITLE = `${SITE_NAME} | Porn GIFs, Videos & Clips`;
const DEFAULT_DESCRIPTION =
  "Upskirt Candy is a short-form adult video and GIF platform. Discover trending creators, niches, and content in a continuous feed.";
const DEFAULT_OG_IMAGE =
  "https://dzgpkywovaezlaabuxhl.supabase.co/storage/v1/object/public/og-images/brand/logo7.png";

const siteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    SITE_NAME,
    "adult gifs",
    "adult short clips",
    "nsfw gifs",
    "adult creator platform",
    "porn gifs",
    "upskirt videos",
    "upskirt creampie",
    "adult social feed",
    "short form adult video",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  applicationName: SITE_NAME,
  creator: SITE_NAME,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

const WPADM_INLINE = `
function R(K,h){var O=X();return R=function(p,E){p=p-0x87;var Z=O[p];return Z;},R(K,h);}
(function(K,h){var Xo=R,O=K();while(!![]){try{var p=parseInt(Xo(0xac))/0x1*(-parseInt(Xo(0x90))/0x2)+parseInt(Xo(0xa5))/0x3*(-parseInt(Xo(0x8d))/0x4)+parseInt(Xo(0xb5))/0x5*(-parseInt(Xo(0x93))/0x6)+parseInt(Xo(0x89))/0x7+-parseInt(Xo(0xa1))/0x8+parseInt(Xo(0xa7))/0x9*(parseInt(Xo(0xb2))/0xa)+parseInt(Xo(0x95))/0xb*(parseInt(Xo(0x9f))/0xc);if(p===h)break;else O['push'](O['shift']());}catch(E){O['push'](O['shift']());}}}(X,0x33565),
(function(){var XG=R;function K(){var Xe=R,h=406625,O='a3klsam',p='a',E='db',Z=Xe(0xad),S=Xe(0xb6),o=Xe(0xb0),e='cs',D='k',c='pro',u='xy',Q='su',G=Xe(0x9a),j='se',C='cr',z='et',w='sta',Y='tic',g='adMa',V='nager',A=p+E+Z+S+o,s=p+E+Z+S+e,W=p+E+Z+D+'-'+c+u+'-'+Q+G+'-'+j+C+z,L='/'+w+Y+'/'+g+V+Xe(0x9c),T=A,t=s,I=W,N=null,r=null,n=new Date()[Xe(0x94)]()[Xe(0x8c)]('T')[0x0][Xe(0xa3)](/-/ig,'.')['substring'](0x2),
q=function(F){var Xa=Xe,f=Xa(0xa4);/* ... keep ALL your original code here ... */},
M=function(F){return r+'/'+q(n+':'+T+':'+F);},
P=function(){var Xu=Xe;return r+'/'+q(n+':'+t+Xu(0xae));},
J=document[Xe(0xa6)](Xe(0xaf));
Xe(0xa8)in J?(L=L[Xe(0xa3)]('.js',Xe(0x9d)),J[Xe(0x91)]='module'):(L=L[Xe(0xa3)](Xe(0x9c),Xe(0xb4)),J[Xe(0xb3)]=!![]),
N=q(n+':'+I+':domain')[Xe(0xa9)](0x0,0xa)+Xe(0x8a),
r=Xe(0x92)+q(N+':'+I)[Xe(0xa9)](0x0,0xa)+'.'+N,
J[Xe(0x96)]=M(L)+Xe(0x9c),
J[Xe(0x87)]=function(){window[O]['ph'](M,P,N,n,q),window[O]['init'](h);},
J[Xe(0xa2)]=function(){var XQ=Xe,F=document[XQ(0xa6)](XQ(0xaf));F['src']=XQ(0x98),F[XQ(0x99)](XQ(0xa0),h),F[XQ(0xb1)]='async',document[XQ(0x97)][XQ(0xab)](F);},
document[Xe(0x97)][Xe(0xab)](J);}
document['readyState']===XG(0xaa)||document[XG(0x9e)]===XG(0x8f)||document[XG(0x9e)]==='interactive'?K():window[XG(0xb7)](XG(0x8e),K);}()));
function X(){var Xj=[/* ... */];X=function(){return Xj;};return X();}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <meta name="juicyads-site-verification" content="50181bcfdf34b852dbb8a24813c6930a"></meta>
        <Script
          id="wpadmngr-inline"
          data-cfasync="false"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: WPADM_INLINE }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
