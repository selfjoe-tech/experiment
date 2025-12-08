"use client";

import { useRef, useState, useEffect, FormEvent } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  Info,
  UploadCloud,
  X,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  submitVerificationRequest,
  getVerificationStateForCurrentUser,
  type VerificationRow,
} from "@/lib/actions/verify";

// import { submitVerificationRequest } from "@/lib/actions/verify"; // when you wire it up

type ProviderKey =
  | "onlyfans"
  | "manyvids"
  | "pornhub"
  | "chaturbate"
  | "fansly"
  | "clips4sale"
  | "loyalfans"
  | "fancentro"
  | "privacy";

type LinkState = Record<ProviderKey, string>;

type VerificationUIState =
  | { mode: "loading" }
  | { mode: "none" } // can apply
  | { mode: "pending"; request: VerificationRow }
  | { mode: "rejected"; request: VerificationRow };

const PROVIDERS: {
  key: ProviderKey;
  label: string;
  short: string;
  placeholder: string;
}[] = [
  {
    key: "manyvids",
    label: "ManyVids",
    short: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.959 12.542C12.2932 12.5306 12.6061 12.7139 12.7593 13.0112C12.9275 13.3197 12.8724 13.7049 12.625 13.9541C12.5003 14.0509 12.4565 14.2211 12.519 14.3662C12.6818 14.9162 12.8181 15.4733 12.9653 16.0273C12.9756 16.0649 12.9802 16.1074 12.9897 16.1597L11.0649 16.1621C11.0697 16.1028 11.0781 16.0438 11.0898 15.9854C11.236 15.4239 11.3781 14.8612 11.5356 14.3027C11.5784 14.2078 11.547 14.0948 11.4619 14.0352C11.1825 13.8198 11.0778 13.4431 11.207 13.1147C11.3164 12.7883 11.6153 12.5609 11.959 12.542Z" fill="#ffffffff"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0ZM9.43408 9.51758C8.80162 9.51758 8.18989 9.74502 7.71094 10.1577C6.70222 11.0225 6.27532 12.3938 6.61475 13.6782C6.88974 14.5562 7.3668 15.3581 8.00732 16.0186C9.14817 17.2418 10.4652 18.288 11.9146 19.1226C11.9852 19.1491 12.0644 19.1434 12.1299 19.106C13.3429 18.3947 14.4666 17.5408 15.4775 16.5635C16.1511 15.927 16.7127 15.1811 17.1382 14.3579C17.8163 12.98 17.5206 11.3104 16.4106 10.249C15.4797 9.3703 14.0402 9.28161 13.0083 10.0396C12.5702 10.383 12.226 10.8316 12.0073 11.3433C11.9083 11.1688 11.8287 11.0133 11.7363 10.8672C11.2702 10.0348 10.3876 9.51758 9.43408 9.51758ZM11.9946 4.5C11.8537 4.50003 11.7167 4.54863 11.6074 4.6377C11.4606 4.75513 11.375 4.93335 11.375 5.12109C11.375 5.279 11.4354 5.43153 11.5439 5.54639C11.5873 5.59898 11.6325 5.70037 11.6099 5.74609C11.4358 6.09357 11.2575 6.44117 11.0576 6.77246C10.9155 7.00918 10.8026 7.02828 10.5884 6.8501C10.3278 6.63329 10.0901 6.38838 9.8457 6.15869C10.032 5.97795 10.1013 5.70722 10.0244 5.45947C9.93238 5.18631 9.65494 5.01614 9.36963 5.05811C9.11576 5.09095 8.90672 5.27716 8.84521 5.52588C8.78115 5.80715 8.9261 6.0974 9.18896 6.21631C9.29777 6.25683 9.37632 6.35354 9.39404 6.46826C9.53796 7.05721 9.69847 7.64641 9.8457 8.23535C9.86853 8.39253 10.0144 8.50458 10.1724 8.48584C11.3906 8.48326 12.6094 8.48242 13.8276 8.48242C13.9851 8.49994 14.1302 8.3871 14.1519 8.22998C14.2939 7.65133 14.449 7.07756 14.5889 6.5C14.607 6.36458 14.6969 6.24883 14.8242 6.19873C15.0296 6.09859 15.1606 5.88926 15.1606 5.66064C15.1606 5.55686 15.1336 5.4549 15.082 5.36475C14.9216 5.07175 14.5506 4.9607 14.2554 5.1167C13.8865 5.31292 13.8316 5.73039 14.1328 6.14014C13.9775 6.30323 13.8224 6.47304 13.6597 6.63428C13.5754 6.71748 13.4838 6.79335 13.3862 6.86035C13.171 7.00898 13.0798 7.0055 12.9443 6.78467C12.7478 6.46626 12.581 6.12947 12.397 5.80371C12.3723 5.77132 12.3594 5.73128 12.3594 5.69043C12.3594 5.62872 12.3898 5.57109 12.4404 5.53613C12.6458 5.32446 12.6681 4.99148 12.4922 4.75439C12.4856 4.7452 12.479 4.73588 12.4717 4.72705C12.355 4.58347 12.1794 4.5 11.9946 4.5Z" fill="#ffffffff"></path></svg>,
    placeholder: "https://manyvids.com/Profile/your-profile",
  },
  {
    key: "pornhub",
    label: "Pornhub",
    short: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.375 13.2954V14.8047C11.375 15.2667 11.3909 15.5497 11.4229 15.6538C11.4548 15.758 11.5132 15.8406 11.5977 15.9014C11.6821 15.9622 11.7896 15.9922 11.9194 15.9922C12.0678 15.9922 12.201 15.9518 12.3184 15.8701C12.4358 15.789 12.5162 15.6879 12.5596 15.5674C12.6029 15.4468 12.6245 15.1513 12.6245 14.6812V13.2954H13.4937V16.5801H12.6865V16.2183C12.5399 16.3837 12.2513 16.6344 11.6982 16.6504L11.6958 16.6509C11.6633 16.6532 11.6306 16.6543 11.5977 16.6543C11.377 16.6543 11.1793 16.6057 11.0039 16.5088C10.8286 16.4119 10.7019 16.2759 10.6235 16.1006C10.5453 15.9253 10.5059 15.6832 10.5059 15.374V13.2954H11.375Z" fill="#ffffffff"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M14.894 12.0459L14.8423 13.5107C15.0557 13.3316 15.5152 13.1882 15.8726 13.2207C15.9709 13.225 16.0594 13.2397 16.1367 13.2603C16.407 13.3205 16.655 13.4517 16.8398 13.6558C17.1015 13.9456 17.2324 14.3615 17.2324 14.9038C17.2324 15.4646 17.099 15.8964 16.832 16.1997C16.5651 16.5026 16.2408 16.6542 15.8594 16.6543C15.8476 16.6543 15.8356 16.6542 15.8237 16.6538C15.8073 16.6542 15.7903 16.6543 15.7725 16.6543C15.3173 16.6543 15.0186 16.48 14.8325 16.3301V16.5801H14.0249V12.0459H14.894ZM15.6147 13.8862C15.4065 13.8863 15.2333 13.9672 15.0952 14.1289C14.9571 14.2907 14.8882 14.5368 14.8882 14.8667C14.8882 15.2069 14.9417 15.4583 15.0488 15.6211C15.1993 15.852 15.3994 15.9677 15.6489 15.9678C15.8406 15.9678 16.0042 15.8856 16.1392 15.7217C16.2742 15.5576 16.3418 15.2995 16.3418 14.9468C16.3418 14.5719 16.2737 14.3013 16.1377 14.1353C16.0016 13.9694 15.8271 13.8862 15.6147 13.8862Z" fill="#ffffffff"></path><path d="M7.87891 12.0459V13.5195C8.09755 13.3092 8.56642 13.2026 8.93262 13.2222C8.93557 13.2223 8.93845 13.2225 8.94141 13.2227C9.11867 13.2292 9.27993 13.2655 9.42529 13.3325C9.5861 13.4067 9.7071 13.5019 9.78857 13.6172C9.86992 13.7326 9.92568 13.8606 9.95557 14.001C9.98542 14.1411 10.0005 14.3588 10.0005 14.6533V16.5801H9.13184V14.8447C9.13183 14.5006 9.11492 14.2824 9.08203 14.1895C9.04912 14.0967 8.99067 14.0229 8.90723 13.9683C8.82387 13.9137 8.71928 13.8863 8.59375 13.8862C8.44935 13.8862 8.32038 13.9213 8.20703 13.9912C8.09353 14.0614 8.0107 14.1671 7.95801 14.3086C7.90548 14.4497 7.87892 14.6584 7.87891 14.9346V16.5801H7.01025V12.0459H7.87891Z" fill="#ffffffff"></path><path d="M10.9131 7.13086C11.1207 7.13089 11.2948 7.20604 11.4355 7.35596C11.5761 7.50592 11.6465 7.72013 11.6465 7.99854C11.6465 8.2843 11.5762 8.50228 11.4355 8.65234C11.2948 8.80222 11.1207 8.87693 10.9131 8.87695C10.7054 8.87695 10.5307 8.80222 10.3892 8.65234C10.2476 8.50228 10.1768 8.28596 10.1768 8.00391C10.1768 7.72187 10.2477 7.50593 10.3892 7.35596C10.5307 7.20602 10.7054 7.13086 10.9131 7.13086Z" fill="#ffffffff"></path><path d="M7.25244 6.16406C7.55422 6.16406 7.75534 6.17313 7.85547 6.19092C7.99139 6.21418 8.10412 6.2724 8.19287 6.36523C8.28141 6.45812 8.32568 6.57593 8.32568 6.71875C8.32568 6.83472 8.29411 6.93645 8.23096 7.02393C8.16776 7.11148 8.08011 7.1758 7.96875 7.2168C7.85726 7.25775 7.63624 7.27832 7.30615 7.27832H6.84766V6.16406H7.25244Z" fill="#ffffffff"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0ZM6.55762 10.7344C6.21915 10.7724 6.03294 10.9796 6 11.3574V17.6123C6.03255 17.9896 6.21844 18.1959 6.55469 18.2354H17.4448C17.7813 18.1959 17.967 17.9896 17.9995 17.6123V11.3574C17.9667 10.9795 17.7803 10.7724 17.4419 10.7344H6.55762ZM10.9102 6.51758C10.6158 6.51758 10.349 6.57895 10.1104 6.70215C9.87145 6.82525 9.68694 7.00391 9.55664 7.23779C9.42641 7.47172 9.36133 7.71389 9.36133 7.96387C9.36133 8.29061 9.42642 8.56788 9.55664 8.79541C9.6869 9.0231 9.87687 9.19576 10.127 9.31348C10.3771 9.43128 10.6404 9.49072 10.916 9.49072C11.3614 9.49069 11.7309 9.34893 12.0244 9.06592C12.318 8.78297 12.4648 8.42608 12.4648 7.99561C12.4648 7.56909 12.3195 7.21585 12.0288 6.93652C11.738 6.65716 11.3651 6.51759 10.9102 6.51758ZM6.00928 5.5V9.42676H6.84766V7.94531H7.39404C7.77338 7.94531 8.06311 7.92657 8.26318 7.88916C8.41057 7.85875 8.55567 7.79679 8.69824 7.70312C8.84071 7.60942 8.95821 7.48027 9.05078 7.31592C9.14324 7.1518 9.18945 6.94911 9.18945 6.70801C9.18945 6.39561 9.10907 6.14073 8.94873 5.94336C8.78825 5.74616 8.58893 5.61793 8.35107 5.55908C8.19629 5.51976 7.86404 5.5 7.35449 5.5H6.00928ZM14.2803 6.51758C14.2366 6.51759 14.1947 6.52134 14.1543 6.52832C13.9188 6.55679 13.6937 6.73667 13.5952 6.85107V6.58154H12.856V9.42627H13.6519V8.54785C13.6519 8.06397 13.6739 7.7461 13.7183 7.59424C13.7626 7.44245 13.8235 7.33742 13.9009 7.2793C13.9783 7.22133 14.0727 7.19241 14.1841 7.19238C14.2992 7.19238 14.424 7.23328 14.5581 7.31543L14.8042 6.65918C14.6362 6.56463 14.4614 6.51758 14.2803 6.51758ZM16.9805 6.51758C16.6621 6.5005 16.1454 6.61541 15.9893 6.84912V6.58203H15.25V9.42627H16.0459V8.13818C16.0459 7.82038 16.0664 7.60209 16.1069 7.48438C16.1475 7.36656 16.2226 7.27216 16.332 7.20068C16.4415 7.12928 16.5654 7.09326 16.7031 7.09326C16.8107 7.09329 16.9026 7.11864 16.979 7.16846C17.0555 7.21844 17.1106 7.28879 17.1445 7.37891C17.1785 7.46923 17.1958 7.66765 17.1958 7.97461V9.42627H17.9912V7.65869C17.9912 7.43903 17.977 7.27017 17.9478 7.15234C17.9185 7.03456 17.8664 6.92923 17.792 6.83643C17.7173 6.74356 17.6072 6.6672 17.4619 6.60742C17.3165 6.5476 17.1561 6.51758 16.9805 6.51758Z" fill="#ffffffff"></path></svg>,
    placeholder: "https://pornhub.com/model/your-profile",
  },
  {
    key: "onlyfans",
    label: "OnlyFans",
    short: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.2363 11.1758C10.4982 11.1237 10.7699 11.1503 11.0166 11.2524C11.2632 11.3546 11.4742 11.5276 11.6226 11.7495C11.7708 11.9715 11.8501 12.2326 11.8501 12.4995C11.8503 12.6768 11.8153 12.8527 11.7476 13.0166C11.6798 13.1804 11.5804 13.3292 11.4551 13.4546C11.3297 13.58 11.1805 13.6793 11.0166 13.7471C10.8528 13.8148 10.6773 13.8498 10.5 13.8496C10.233 13.8496 9.97199 13.7703 9.75 13.6221C9.528 13.4738 9.35511 13.2628 9.25293 13.0161C9.15076 12.7695 9.12371 12.4982 9.17578 12.2363C9.22787 11.9745 9.35662 11.7337 9.54541 11.5449C9.73413 11.3563 9.97461 11.2279 10.2363 11.1758Z" fill="#ffffffff"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0ZM17.2397 8C15.298 8 14.2544 8.10414 13.4399 9.09521C12.6255 8.39189 11.5834 8.00001 10.5 8C9.61002 8 8.73999 8.26391 8 8.7583C7.25999 9.25273 6.68336 9.95563 6.34277 10.7778C6.0022 11.6 5.91281 12.5046 6.08643 13.3774C6.26004 14.2502 6.68864 15.0519 7.31787 15.6812C7.94719 16.3104 8.74917 16.739 9.62207 16.9126C9.91243 16.9704 10.2063 16.9985 10.4995 16.9985C10.5112 16.9985 10.523 16.9981 10.5347 16.998C10.5679 16.9978 10.6011 16.9976 10.6343 16.9966C10.6679 16.9956 10.7014 16.9939 10.7349 16.9922C10.7559 16.9911 10.7769 16.9902 10.7979 16.9888C10.8314 16.9866 10.8649 16.9834 10.8984 16.9805C10.9176 16.9788 10.9369 16.9775 10.9561 16.9756C10.9898 16.9722 11.0235 16.9681 11.0571 16.9639C11.0811 16.9609 11.105 16.958 11.1289 16.9546C11.1611 16.9501 11.1931 16.9447 11.2251 16.9395C11.2437 16.9364 11.2622 16.9334 11.2808 16.9302C11.3255 16.9223 11.3701 16.914 11.4146 16.9048C11.4216 16.9033 11.4286 16.9019 11.4355 16.9004C11.4838 16.8901 11.5318 16.879 11.5796 16.8672C11.5851 16.8658 11.5907 16.8647 11.5962 16.8633C11.6381 16.8528 11.6797 16.8413 11.7212 16.8296C11.7349 16.8257 11.7486 16.8219 11.7622 16.8179C11.8545 16.7909 11.9458 16.7609 12.0361 16.728C12.0496 16.7231 12.0632 16.7184 12.0767 16.7134C12.1159 16.6987 12.155 16.6833 12.1938 16.6675C12.2031 16.6637 12.2129 16.6606 12.2222 16.6567C12.224 16.656 12.2257 16.6551 12.2275 16.6543C12.2597 16.6409 12.2914 16.6264 12.3232 16.6123C12.3449 16.6027 12.3667 16.5934 12.3882 16.5835C12.4165 16.5704 12.4446 16.5567 12.4727 16.543C12.4943 16.5324 12.5157 16.5216 12.5371 16.5107C12.5512 16.5036 12.5651 16.4961 12.5791 16.4888C13.2475 16.1404 13.8206 15.6297 14.2417 14.9995C14.3933 14.7727 14.5226 14.5333 14.6299 14.2852C16.4187 14.1535 17.6589 13.0831 18.0503 11.3745C18.0337 11.3785 16.6938 11.7015 15.5576 11.3745C17.8187 10.9364 19.1215 9.66484 19.4995 8H17.2397Z" fill="#ffffffff"></path></svg>,
    placeholder: "https://onlyfans.com/your-profile",
  },
  {
    key: "chaturbate",
    label: "Chaturbate",
    short: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.9209 11.6138C10.9624 11.6171 11.0027 11.6292 11.0391 11.6494C11.0755 11.6697 11.1072 11.6979 11.1318 11.7314C11.1565 11.765 11.1736 11.8035 11.1821 11.8442C11.1906 11.885 11.1904 11.9272 11.1812 11.9678C11.043 12.5671 10.971 13.1799 10.9663 13.7949C10.9663 14.9773 11.2693 16.206 12.0039 17.0522C11.0544 16.2184 10.6753 14.8349 10.6753 13.5063C10.68 12.8913 10.7525 12.2786 10.8906 11.6792C10.8954 11.6577 10.8976 11.6358 10.8975 11.6138H10.9209Z" fill="#ffffffff"></path><path d="M16.3618 14.0059C16.4591 14.0172 16.548 14.0364 16.6284 14.063C16.8403 14.1332 16.9939 14.2564 17.0894 14.4307L17.0908 14.4331C16.9553 14.3583 16.8059 14.3117 16.6519 14.2964C16.3338 15.4686 15.1637 16.584 14.1899 16.584C13.5773 16.584 13.1053 16.365 12.7974 15.9609C13.0849 16.1782 13.4553 16.2934 13.8999 16.2935C14.8767 16.2935 16.0437 15.1781 16.3618 14.0059Z" fill="#ffffffff"></path><path d="M15.2778 7.2207C16.1922 7.22071 16.8777 7.49291 17.2036 7.94775C16.8292 7.66798 16.2657 7.51124 15.5679 7.51123C13.8079 7.51123 12.5461 8.77778 11.8091 10.2207C11.6334 10.5647 11.4878 10.9188 11.3721 11.2681C11.353 11.3262 11.3156 11.3772 11.2661 11.4131C11.2167 11.4489 11.1572 11.4681 11.0962 11.4683C11.0736 11.4683 11.0508 11.4657 11.0288 11.4604C10.9795 11.4488 10.9315 11.4352 10.8838 11.4219C10.8582 11.4148 10.8322 11.4077 10.8066 11.4009C10.7586 11.3554 10.6964 11.3277 10.6304 11.3228L10.4995 11.311C9.59304 11.0164 8.85287 10.5538 8.32227 9.95752C8.93419 10.5186 9.75191 10.9369 10.7397 11.1714C10.7617 11.1766 10.7841 11.1793 10.8066 11.1792C10.8678 11.1791 10.9275 11.1595 10.9771 11.1235C11.0266 11.0876 11.0634 11.0371 11.0825 10.979C11.1933 10.6435 11.332 10.3036 11.498 9.97266C12.2315 8.51121 13.5007 7.2207 15.2778 7.2207Z" fill="#ffffffff"></path><path d="M15.0283 9.74414C15.2971 9.74414 15.4843 9.9075 15.4844 10.106C15.4844 10.4561 14.937 10.947 13.374 11.0635C13.853 10.293 14.4602 9.74427 15.0283 9.74414Z" fill="#ffffffff"></path><path d="M15.7153 9.84131C15.8191 9.89221 15.9069 9.9705 15.9692 10.0679C16.0315 10.1653 16.0662 10.278 16.0688 10.3936C16.0686 10.4197 16.0664 10.4458 16.063 10.4717C15.8087 10.6243 15.5417 10.7554 15.2651 10.8628C15.627 10.6346 15.7778 10.3599 15.7778 10.106C15.7779 10.0141 15.7564 9.92351 15.7153 9.84131Z" fill="#ffffffff"></path><path d="M7.11084 7.69922C7.1319 7.83624 7.16065 7.97198 7.19629 8.10596C6.34068 8.60214 5.87711 9.10323 5.87695 9.54395C5.88228 9.72377 5.94739 9.89699 6.06201 10.0356C5.75428 9.79034 5.58552 9.52625 5.58545 9.25439C5.58545 8.77927 6.12316 8.23373 7.11084 7.69922Z" fill="#ffffffff"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M15.2769 6.68311C16.2887 6.68311 16.9558 6.9644 17.3618 7.32227C17.7668 7.67923 17.9531 8.14645 17.9531 8.61182C17.9531 9.77632 16.7067 11.3556 13.79 11.7998C13.701 11.8134 13.6102 11.826 13.5181 11.8374L13.1987 11.877L13.0781 12.1753C12.8018 12.8582 12.6294 13.5881 12.6294 14.2051C12.6294 14.7653 12.7521 15.2181 13.0811 15.499C13.3852 15.7587 13.7476 15.7567 13.8804 15.7559C13.8873 15.7558 13.8938 15.7559 13.8994 15.7559C14.1462 15.7558 14.3807 15.6436 14.5479 15.543C14.7347 15.4305 14.9263 15.2776 15.1021 15.0996C15.4451 14.7522 15.7916 14.2459 15.8853 13.6646L15.9185 13.4556H16.1299C16.6745 13.4556 17.0705 13.6207 17.3262 13.8623C17.5786 14.101 17.7437 14.4607 17.7437 14.9521C17.7433 15.6009 17.4146 16.465 16.7837 17.1714C16.1626 17.8666 15.2905 18.3628 14.2393 18.3628C12.9748 18.3628 11.969 17.8926 11.272 17.0815C10.5678 16.2623 10.1393 15.0476 10.1392 13.5039C10.1404 13.1312 10.1667 12.7589 10.2173 12.3896L10.2925 11.8408L9.74268 11.7725C8.15073 11.5748 6.93938 11.2074 6.14307 10.7378C5.34964 10.2698 5.04695 9.75579 5.04688 9.25439C5.04688 8.58366 5.58565 7.83026 7.25342 7.02295L7.59229 6.8584L7.60596 7.2373C7.67682 9.14134 9.07292 10.0339 10.1338 10.4282L10.6226 10.6099L10.8276 10.1304C10.902 9.95638 10.9812 9.78829 11.0645 9.62646C12.038 7.73424 13.5978 6.68318 15.2769 6.68311ZM15.2769 6.93018C13.4889 6.93025 12.0967 8.149 11.2632 9.78516C11.0843 10.1363 10.931 10.5065 10.8052 10.8882C8.8788 10.4341 7.43137 9.20716 7.36182 7.24561C5.91385 7.94576 5.29516 8.63667 5.29346 9.25635C5.29346 10.4474 7.55957 11.3698 10.6074 11.6152C10.4646 12.2356 10.3904 12.8698 10.3857 13.5063C10.3857 15.9454 11.5531 18.1171 14.2383 18.1172C16.2232 18.1172 17.4955 16.1794 17.4956 14.9531C17.4956 14.881 17.4914 14.8113 17.4834 14.7446C17.4052 14.1019 16.9533 13.7181 16.1772 13.7031C16.1616 13.7028 16.1457 13.7026 16.1299 13.7026C15.9423 14.8701 14.752 16.0023 13.8994 16.0024C12.8022 16.0024 12.3814 15.2203 12.3813 14.2036C12.3813 13.3979 12.6504 12.4522 13.0474 11.6348C13.21 11.6221 13.3685 11.6059 13.5225 11.5864C16.3315 11.232 17.7061 9.79626 17.7061 8.61084C17.7059 7.70046 16.8882 6.93018 15.2769 6.93018Z" fill="#ffffffff"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0ZM7.01514 6.53076C5.32316 7.34979 4.5 8.23842 4.5 9.25439C4.50014 10.7189 6.24245 11.8063 9.23145 12.2549C9.37641 12.2766 9.52453 12.2967 9.67529 12.3154C9.66515 12.3895 9.65575 12.4638 9.64746 12.5381C9.61172 12.8585 9.59331 13.1809 9.59229 13.5034C9.59233 16.7873 11.4165 18.9097 14.2393 18.9097C16.712 18.9096 18.2897 16.5652 18.2905 14.9521C18.2905 13.7104 17.4419 12.9088 16.1299 12.9087H15.4521L15.3452 13.5776C15.2069 14.4363 14.2793 15.2083 13.8994 15.2085C13.629 15.2085 13.1763 15.2085 13.1763 14.2051C13.1763 13.6784 13.3263 13.0196 13.585 12.3804C13.8536 12.3472 14.1117 12.3046 14.3589 12.2534C17.0831 11.6893 18.5 10.0871 18.5 8.61182C18.5 7.37938 17.5034 6.13574 15.2769 6.13574C13.3738 6.13581 11.6781 7.3095 10.6289 9.2793C10.5204 9.48293 10.4189 9.6953 10.3247 9.91553C10.1821 9.86254 10.0361 9.80109 9.89062 9.72998C9.86823 9.71903 9.8456 9.70771 9.82324 9.69629C9.01453 9.28335 8.23864 8.56276 8.15723 7.30908C8.15527 7.27899 8.15398 7.24849 8.15283 7.21777L8.10889 6L7.01514 6.53076Z" fill="#ffffffff"></path></svg>,
    placeholder: "https://chaturbate.com/your-profile",
  },
  {
    key: "fansly",
    label: "Fansly",
    short: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.002 12.4331C12.8748 12.4331 13.5829 13.1316 13.5796 13.9912C13.5762 14.8475 12.8549 15.5652 12.002 15.5586C11.1424 15.5553 10.4507 14.8474 10.4507 13.9746C10.4507 13.1183 11.1391 12.4331 12.002 12.4331ZM12.2949 13.0459C11.8833 12.878 11.3764 13.0754 11.1426 13.4902C10.8923 13.9217 11.0009 14.4686 11.3994 14.7881C11.7683 15.0844 12.361 15.0483 12.7134 14.7158C12.9999 14.4457 13.1382 13.8889 12.8813 13.5332C12.7134 13.6517 12.539 13.6582 12.3843 13.52C12.2394 13.3883 12.2061 13.2237 12.2949 13.0459Z" fill="#ffffffff"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0ZM18.4937 10.8389C18.622 8.85949 16.8601 7.18009 14.772 7.55225C14.0902 7.67411 13.5236 8.00669 13.0361 8.49414C11.6232 9.90704 10.2101 11.3198 8.79395 12.7261C8.75442 12.7689 8.71151 12.8084 8.66211 12.8545C8.28676 12.4791 7.92774 12.1171 7.56885 11.7549C6.95954 11.1423 6.95308 10.1607 7.55908 9.55469C8.17495 8.93882 9.15948 8.93536 9.77539 9.54785C10.0026 9.77838 10.2365 10.0025 10.4604 10.2363C10.5658 10.3483 10.6517 10.358 10.7637 10.2427C11.0337 9.96277 11.3104 9.68934 11.5903 9.41602C11.6989 9.3107 11.7056 9.22188 11.5938 9.11328C11.3731 8.90249 11.1588 8.68173 10.9414 8.46436C10.207 7.73323 9.32439 7.40054 8.29688 7.53223C7.03878 7.69361 6.14925 8.38191 5.71777 9.5708C5.27314 10.7894 5.5104 11.9228 6.41943 12.8516C8.09584 14.5675 9.8053 16.2473 11.5015 17.9468C11.8406 18.2859 12.1799 18.2859 12.519 17.9468C13.7772 16.6886 15.0353 15.4334 16.2935 14.1753C16.4581 14.0106 16.4583 13.9778 16.2969 13.8164C15.289 12.8053 14.2779 11.7974 13.27 10.7896C13.2272 10.7467 13.1876 10.7008 13.1382 10.6514C13.5104 10.2792 13.8694 9.91344 14.2383 9.54785C14.8607 8.9353 15.8553 8.9387 16.458 9.54785C17.0673 10.167 17.0609 11.1385 16.4419 11.7676C16.2146 11.9981 15.9873 12.2292 15.7534 12.4531C15.6449 12.5552 15.6514 12.6406 15.7534 12.7427C16.0366 13.0193 16.3166 13.2992 16.5933 13.5791C16.6953 13.6844 16.7842 13.6781 16.8862 13.5762C17.1167 13.3424 17.354 13.115 17.5845 12.8779C18.1345 12.3114 18.441 11.6326 18.4937 10.8389Z" fill="#ffffffff"></path></svg>,
    placeholder: "https://fansly.com/your-profile",
  },
  {
    key: "clips4sale",
    label: "Clips4Sale",
    short: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0ZM10.8135 8.5L9.69434 12.6196H12.269L11.9741 16.5L14.3335 10.3491H12.6099L12.3813 11.1475H11.6694L12.3896 8.5H10.8135ZM6.76221 9.61426C5.40102 9.61426 3.50003 10.0905 3.5 11.8096C3.5 13.4301 5.10893 14.0049 6.76221 14.0049C7.81465 14.0049 8.56975 13.8407 9.39697 13.5176L9.11035 12.5215C8.47106 12.7732 7.82622 12.9595 6.88379 12.9595C5.65519 12.9539 4.98304 12.5217 4.98291 11.8154C4.98291 11.109 5.61126 10.6655 6.88965 10.6655C7.69415 10.6655 8.47714 10.8298 9.11035 11.1035L9.39014 10.1016C8.56966 9.74014 7.75957 9.61426 6.76221 9.61426ZM17.2627 14.0049H17.2681C17.2669 14.0049 17.2658 14.0044 17.2646 14.0044L17.2627 14.0049ZM17.5659 9.6084C15.8357 9.6084 14.6562 10.0031 14.6562 10.9502C14.6563 11.8971 15.5159 12.1875 17.3286 12.3188C18.3813 12.401 18.7119 12.4611 18.7119 12.6802C18.7117 12.8992 18.3312 13.0303 17.2681 13.0303C16.342 13.0303 15.593 12.8936 14.9648 12.6855L14.6509 13.6709C15.438 13.9169 16.2908 14.0042 17.2646 14.0044C18.9169 14.0041 20.1665 13.621 20.1665 12.521C20.1665 11.5248 19.2472 11.333 17.395 11.2017C16.4253 11.1306 16.1495 11.0538 16.1494 10.8623C16.1494 10.6707 16.5575 10.5884 17.5659 10.5884C18.3978 10.5884 19.1691 10.698 19.7422 10.9277L20.04 9.93164C19.4181 9.69086 18.4524 9.60841 17.5659 9.6084Z" fill="#ffffffff"></path></svg>,
    placeholder: "https://clips4sale.com/studio/your-studio",
  },
  {
    key: "loyalfans",
    label: "LoyalFans",
    short: "LF",
    placeholder: "https://loyalfans.com/your-profile",
  },
  {
    key: "fancentro",
    label: "FanCentro",
    short: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0ZM15.8613 8.5C13.1709 8.5 11.9329 10.4541 11.9434 12.2954C11.9536 14.2391 13.0483 16.0088 15.8613 16.0088C16.9456 16.0088 17.9277 15.6914 18.7358 14.8936L17.5493 13.564C17.0379 14.0855 16.342 14.29 15.8613 14.29C14.4496 14.29 13.9585 13.2366 13.9482 12.3057C13.9378 11.3748 14.4803 10.2495 15.8613 10.2495C16.342 10.2495 16.8738 10.3825 17.3853 10.8735L18.6333 9.64551C17.8253 8.85802 16.8946 8.50003 15.8613 8.5ZM6 8.66357V15.8247H8.00488V13.3589H11.2783V11.7017H8.00488V10.3618H11.4937V8.66357H6Z" fill="#ffffffff"></path></svg>,
    placeholder: "https://fancentro.com/your-profile",
  },
  {
    key: "privacy",
    label: "Privacy.com",
    short: "P",
    placeholder: "https://privacy.com/your-profile",
  },
];

const PINK_BTN =
  "bg-pink-500 hover:bg-pink-600 text-black font-semibold rounded-full";

export default function VerifyPage() {
  const [links, setLinks] = useState<LinkState>({} as LinkState);
  const [activeProviders, setActiveProviders] = useState<ProviderKey[]>([]);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [verifyState, setVerifyState] = useState<VerificationUIState>({
    mode: "loading",
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const state = await getVerificationStateForCurrentUser();
        if (cancelled) return;

        console.log(state, "<-----------")

        if (state.status === "pending") {
          setVerifyState({ mode: "pending", request: state.request });
          return;
        }

        if (state.status === "rejected") {
          setVerifyState({ mode: "rejected", request: state.request, notes: state.request.review_notes });

          // optional: prefill links from last rejected request
          const dbLinks = (state.request.links || {}) as LinkState;
          setLinks(dbLinks);
          const active = (Object.keys(dbLinks) as ProviderKey[]).filter(
            (k) => dbLinks[k]?.trim()
          );
          setActiveProviders(active);
          return;
        }

        setVerifyState({ mode: "none" });
      } catch {
        setVerifyState({ mode: "none" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);


  const toggleProvider = (key: ProviderKey) => {
    setActiveProviders((prev) => {
      if (prev.includes(key)) {
        // turning off → also clear the link
        setLinks((old) => ({ ...old, [key]: "" }));
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const handleLinkChange = (key: ProviderKey, value: string) => {
    setLinks((prev) => ({ ...prev, [key]: value }));
  };

  const clearLink = (key: ProviderKey) => {
    setLinks((prev) => ({ ...prev, [key]: "" }));
  };

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  };

  // ✅ only require at least ONE filled link total
  const validate = () => {
    const filled = activeProviders
      .map((k) => links[k])
      .filter((v) => v && v.trim().length > 0);

    if (filled.length < 1) {
      return "Add at least one profile link by clicking a logo and pasting your URL.";
    }
    if (!selfieFile) {
      return "Please upload a verification photo.";
    }
    return null;
  };

    const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      activeProviders.forEach((key) => {
        const value = links[key];
        if (value && value.trim()) formData.append(key, value.trim());
      });
      if (selfieFile) formData.append("selfie", selfieFile);

      const created = await submitVerificationRequest(formData);
      // assume submitVerificationRequest returns the created row, or at least created_at
      if (created?.id) {
        setVerifyState({
          mode: "pending",
          request: created as VerificationRow,
        });
      }

      setSuccess(
        "Verification request submitted! We'll review your application soon."
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to submit verification request.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  if (verifyState.mode === "loading") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <span className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (verifyState.mode === "pending") {
    const { request } = verifyState;
    return (
      <div className="mb-5 min-h-screen bg-black text-white px-3 sm:px-6 lg:px-10 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <header className="space-y-2">
            <div className="inline-flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold">
                Content Creator Verification
              </h1>
              <BadgeCheck className="h-5 w-5 text-yellow-400" />
            </div>
            <p className="text-sm text-white/70 max-w-2xl">
              Your verification request is currently being reviewed.
            </p>
          </header>

          <section className="rounded-2xl bg-[#121212] border border-white/10 px-4 py-6 sm:px-6 sm:py-7">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-yellow-500/20 border border-yellow-400/70 flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-300" />
              </div>
              <div className="space-y-2">
                <h2 className="text-base sm:text-lg font-semibold">
                  Verification request pending
                </h2>
                <p className="text-sm text-white/75">
                  We received your application on{" "}
                  <span className="font-semibold">
                    {formatDateTime(request.created_at)}
                  </span>
                  . You don&apos;t need to submit another request while it&apos;s
                  pending.
                </p>
                <p className="text-xs text-white/55">
                  Check back in 3 days or less
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }





  return (
    <div className="mb-5 min-h-screen bg-black text-white px-3 sm:px-6 lg:px-10 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold">
              Content Creator Verification
            </h1>
            <BadgeCheck className="h-5 w-5 text-yellow-400" />
          </div>
          <p className="text-sm text-white/70 max-w-2xl">
            Verification helps your profile stand out and lets you add links to
            other sites with more of your content. Follow the steps below to
            request verification.
          </p>
        </header>





        {verifyState.mode === "rejected" && (
          <section className="rounded-2xl bg-[#1A1012] border border-pink-500/50 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-pink-400 mt-[2px]" />
              <div className="space-y-1">
                <h2 className="text-sm sm:text-base font-semibold">
                  Your last application was rejected
                </h2>
                <p className="text-xs sm:text-sm text-white/75">
                  Submitted:{" "}
                  <span className="font-semibold">
                    {formatDateTime(verifyState.request.created_at)}
                  </span>
                  {verifyState.request.reviewed_at && (
                    <>
                      {" — "}Reviewed:&nbsp;
                      <span className="font-semibold">
                        {formatDateTime(verifyState.request.reviewed_at)}
                      </span>
                    </>
                  )}
                </p>
                {verifyState.notes && (
                  <p className="text-xs text-white/70">
                    Notes from review: {verifyState.notes}
                  </p>
                )}
                <p className="text-xs text-white/55">
                  Please update your links or photo below and submit a new
                  application.
                </p>
              </div>
            </div>
          </section>
        )}





        <form onSubmit={handleSubmit} className="space-y-6">
          {/* STEP 1 – LINKS */}
          <section className="rounded-2xl bg-[#121212] border border-white/10 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,2.2fr)]">
              {/* Left copy */}
              <div>
                <StepHeader step={1} title="Provide your links" />
                <p className="mt-3 text-sm text-white/80">
                  Click a logo to add a link field. You must add{" "}
                  <span className="font-semibold">at least one</span> link, but
                  you can add as many platforms as you want.
                </p>
                <p className="mt-3 text-xs text-white/60">
                  Make sure the accounts you submit clearly match your profile
                  name and branding.
                </p>
              </div>

              {/* Right side – icons + active link fields */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/60">
                    Required links <span className="normal-case">(select at least one)</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-white/50">
                    <Info className="h-3.5 w-3.5" />
                    Click a logo to add your link
                  </div>
                </div>

                {/* Logos row */}
                <div className="flex flex-wrap gap-2">
                  {PROVIDERS.map((p) => {
                    const active = activeProviders.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => toggleProvider(p.key)}
                        className={`h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-semibold border transition 
                          ${
                            active
                              ? "bg-pink-500 border-pink-400 text-black"
                              : "bg-white/5 border-white/20 text-white/80 hover:bg-white/10"
                          }`}
                        aria-pressed={active}
                      >
                        {p.short}
                      </button>
                    );
                  })}
                </div>

                {/* Active link fields (only for clicked icons) */}
                {activeProviders.length > 0 && (
                  <div className="space-y-2.5 max-h-[20rem] overflow-y-auto pr-1">
                    {activeProviders.map((key) => {
                      const provider = PROVIDERS.find((p) => p.key === key)!;
                      const value = links[key] || "";
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5"
                        >
                          <div className="shrink-0 h-8 w-8 rounded-full bg-pink-500 text-black flex items-center justify-center text-[10px] font-semibold">
                            {provider.short}
                          </div>

                          <div className="flex-1 min-w-0">
                            <label
                              htmlFor={`link-${key}`}
                              className="block text-xs text-white/70 mb-1"
                            >
                              {provider.label}
                            </label>
                            <div className="flex items-center gap-2">
                              <Input
                                id={`link-${key}`}
                                value={value}
                                onChange={(e) =>
                                  handleLinkChange(key, e.target.value)
                                }
                                placeholder={provider.placeholder}
                                className="h-9 text-xs bg-black/40 border-white/20"
                              />
                              {value.trim().length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => clearLink(key)}
                                  className="p-1 rounded-full hover:bg-white/10 text-white/70"
                                  aria-label={`Clear ${provider.label} link`}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeProviders.length === 0 && (
                  <p className="text-[11px] text-white/45">
                    No links selected yet. Click any logo above to add your
                    first link.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* STEP 2 – PHOTO */}
          <section className="rounded-2xl bg-[#121212] border border-white/10 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,2.2fr)] items-center">
              <div>
                <StepHeader step={2} title="Upload photo" />
                <p className="mt-3 text-sm text-white/80">
                  Your verification photo must follow these rules:
                </p>
                <ul className="mt-3 space-y-2 text-sm text-white/75 list-disc pl-5">
                  <li>
                    SFW selfie of you holding a sign with your profile URL (or
                    username) clearly visible.
                  </li>
                  <li>
                    Your appearance should match the identity shown in your
                    linked profiles.
                  </li>
                  <li>No heavy filters or digitally altered images.</li>
                  <li>Accepted file types: JPG, PNG.</li>
                </ul>
              </div>

              <div className="flex flex-col items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-32 w-32 sm:h-40 sm:w-40 rounded-full border border-white/30 flex items-center justify-center overflow-hidden hover:border-pink-500/80 transition-colors"
                >
                  {selfiePreview ? (
                    <Image
                      src={selfiePreview}
                      alt="Verification selfie preview"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-xs text-white/60 gap-2">
                      <UploadCloud className="h-7 w-7 text-white/70" />
                      <span>Add photo</span>
                    </div>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={handleSelfieChange}
                />
                <p className="text-[11px] text-white/50 text-center max-w-xs">
                  Click the circle to upload. We’ll only use this photo to
                  manually review your verification request.
                </p>
              </div>
            </div>
          </section>

          {/* STEP 3 – SUBMIT */}
          <section className="rounded-2xl bg-[#121212] border border-white/10 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <StepHeader step={3} title='Hit "Verify Account"' />
                <p className="mt-3 text-sm text-white/75 max-w-md">
                  When you submit, we’ll review your links and photo. You’ll get
                  an email once your verification has been approved or if we
                  need more info.
                </p>
              </div>

              <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto">
                <Button
                  type="submit"
                  disabled={submitting}
                  className={`${PINK_BTN} w-full sm:w-60 h-11 inline-flex items-center justify-center gap-2`}
                >
                  {submitting && (
                    <span className="h-4 w-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                  )}
                  Verify Account
                </Button>

                {error && (
                  <div className="flex items-start gap-2 text-xs text-red-300 max-w-xs">
                    <AlertCircle className="h-3.5 w-3.5 mt-[2px]" />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="flex items-start gap-2 text-xs text-emerald-300 max-w-xs">
                    <BadgeCheck className="h-3.5 w-3.5 mt-[2px]" />
                    <span>{success}</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}

function StepHeader({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-full border border-white/40 flex items-center justify-center text-sm">
        {step}
      </div>
      <h2 className="text-base sm:text-lg font-semibold">{title}</h2>
    </div>
  );
}
