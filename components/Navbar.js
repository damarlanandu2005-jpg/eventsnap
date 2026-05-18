import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="relative z-50 border-b border-white/10 px-8 py-5 flex items-center bg-[#0D0A14]/80 backdrop-blur-md sticky top-0">
      <Link href="/" className="flex items-center gap-2.5 no-underline group">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] flex items-center justify-center text-[#F0C060] font-bold shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-all">✦</div>
        <span className="font-['Playfair_Display'] font-bold text-xl text-[#F0C060]">EventSnap</span>
      </Link>
    </nav>
  );
}
