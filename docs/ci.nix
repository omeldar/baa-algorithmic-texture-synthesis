{ pkgs ? import <nixpkgs> {} }:

pkgs.stdenv.mkDerivation {
  name = "thesis-pdf";
  src = ./.; # This pulls everything in the /docs folder
  
  nativeBuildInputs = [ 
    pkgs.tectonic 
    pkgs.biber-for-tectonic
    pkgs.gnumake
    pkgs.texlive.combined.scheme-full 
  ];
  
  buildPhase = ''
    export TECTONIC_CACHE_DIR=$TMPDIR/tectonic
    make
  '';
  
  installPhase = ''
    mkdir -p $out
    cp build/main.pdf $out/
  '';
}