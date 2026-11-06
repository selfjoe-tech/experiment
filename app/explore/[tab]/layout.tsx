import type { Metadata } from "next";
import { absoluteSeoUrl } from "@/lib/server/publicSeo";

const LABELS:Record<string,{name:string;description:string}>={
  gifs:{name:"Videos",description:"Browse public creator videos and discover topics on Goon Gram."},
  images:{name:"Images",description:"Browse public creator images and discover topics on Goon Gram."},
  creators:{name:"Creators",description:"Discover creators sharing publicly available videos and images on Goon Gram."},
  niches:{name:"Niches",description:"Explore topics and creator communities with public media on Goon Gram."},
};
export async function generateMetadata({params}:{
  params:Promise<{tab:string}>
}):Promise<Metadata>{
  const {tab}=await params;
  const item=LABELS[tab];
  if(!item)return{robots:{index:false,follow:false},title:"Explore"};
  const canonical=absoluteSeoUrl("/explore/"+tab);
  return{
    title:`Explore ${item.name}`,
    description:item.description,
    alternates:{canonical},
    robots:{index:true,follow:true},
    openGraph:{title:`Explore ${item.name}`,description:item.description,url:canonical},
    twitter:{card:"summary",title:`Explore ${item.name}`,description:item.description},
  };
}
export default function ExploreTabLayout({children}:{children:React.ReactNode}){return children;}
