import Image from "next/image";



export function ShortLogo(
  ) {
  return (
    <div className=" mt-5 gap-1 items-center justify-center ">
        
          <Image
            src={"/icons/logo7.png"}
            height={50}
            width={50}
            alt="Upskirt Candy heart shaped logo with a halo on top of it"
          />
        
      </div>
  );
}
