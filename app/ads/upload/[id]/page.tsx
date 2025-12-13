import { Suspense } from "react";
import AdsUploadPage from "./AdsUploadPage";


type PageProps = {
  params: Promise<{ id: string }>;
};

export default function UploadAdsPage( {params}: PageProps ) {

    <Suspense>
        <AdsUploadPage params={params} />
    </Suspense>
}
