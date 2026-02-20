{
  description = "CI-specific build environment for BAA thesis";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux"; # GitHub Runners are typically x86_64
      pkgs = import nixpkgs { inherit system; };
    in {
      packages.${system}.default = pkgs.stdenv.mkDerivation {
        name = "thesis-pdf";
        src = ./.;
        nativeBuildInputs = [ 
          pkgs.tectonic 
          pkgs.biber-for-tectonic [cite: 5]
          pkgs.gnumake [cite: 4]
          # This provides the missing TeX Gyre fonts
          pkgs.texlive.combined.scheme-full 
        ];
        
        # Point to your existing Makefile [cite: 15]
        buildPhase = "make"; 
        
        installPhase = ''
          mkdir -p $out
          cp build/main.pdf $out/
        '';
      };
    };
}