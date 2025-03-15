import { WalletSelector } from "./WalletSelector";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

export function CoraHeader() {
  const { connected } = useWallet();
  
  return (
    <header className="w-full py-[30px] px-4 md:px-8 lg:px-16 2xl:px-[116px]">
      <div className="rounded-3xl transform-gpu transition-all duration-300 hover:shadow-[0px_16px_40px_4px_rgba(46,139,87,0.2)] p-[1px] bg-gradient-to-b from-[#606064] via-[#60606442] to-[#3CB371BD] w-full">
        <div className="black_card_gradient_with_colors h-full w-full relative rounded-[23px] overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center">
              <h1 className="text-3xl font-neue font-extrabold gradient_text_2">CORA</h1>
              <span className="ml-2 text-sm text-cora-secondary">Insurance</span>
            </div>
            <div className="flex items-center space-x-8">
              <ul className="hidden md:flex items-center space-x-8">
                <li>
                  <a href="https://t.me/cora_insurance" target="_blank" rel="noopener noreferrer" className="hover:text-cora-primary transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      className="w-6 h-6"
                    >
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="m11.985 15.408l3.242 3.686c1.2 1.365 1.801 2.048 2.43 1.881c.628-.166.844-1.064 1.275-2.861l2.39-9.968c.665-2.768.997-4.151.259-4.834s-2.017-.175-4.575.84L5.14 8.865c-2.046.813-3.069 1.219-3.134 1.917a1 1 0 0 0 0 .214c.063.699 1.084 1.108 3.128 1.927c.925.371 1.388.557 1.72.912q.056.06.108.124c.306.38.436.88.697 1.876l.489 1.867c.253.97.38 1.456.713 1.522s.622-.336 1.201-1.141zm0 0l-.317-.33c-.362-.378-.543-.566-.543-.8s.18-.423.543-.8l3.573-3.724"
                        color="currentColor"
                      ></path>
                    </svg>
                  </a>
                </li>
                <li>
                  <a href="https://x.com/cora_insurance" target="_blank" rel="noopener noreferrer" className="hover:text-cora-primary transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      className="w-6 h-6"
                    >
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="m3 21l7.548-7.548M21 3l-7.548 7.548m0 0L8 3H3l7.548 10.452m2.904-2.904L21 21h-5l-5.452-7.548"
                        color="currentColor"
                      ></path>
                    </svg>
                  </a>
                </li>
              </ul>
              <div className="cora-button group">
                <span className="absolute inset-0 bg-gradient-to-b from-cora-light to-cora-primary"></span>
                <span className="absolute inset-0 bg-gradient-to-b from-cora-light via-cora-light-green to-cora-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="relative flex items-center whitespace-pre-wrap text-center text-lg md:text-xl font-medium leading-none tracking-tight text-cora-dark">
                  <WalletSelector />
                </span>
              </div>
            </div>
          </div>
          <div
            className="absolute inset-0 opacity-10 z-0"
            style={{
              backgroundImage: `url('/assets/dots_svg.svg')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
        </div>
      </div>
    </header>
  );
}