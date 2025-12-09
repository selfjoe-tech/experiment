import Image from "next/image";



export function ShortLogo(
  ) {
  return (
    <div className="flex mt-10 gap-1 items-center justify-center text-2xl font-bold tracking-wide mb-8">
        
          <Image
            src={"/icons/logo7.png"}
            height={60}
            width={60}
            alt="Upskirt Candy heart shaped logo with a halo on top of it"
          />
        
      </div>
  );
}
