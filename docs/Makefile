MAIN=main
OUTDIR=build

.PHONY: all pdf clean

all: pdf

$(OUTDIR):
	mkdir -p $(OUTDIR)

pdf: $(OUTDIR)
	# 1. First pass to generate .acn and .bcf files
	tectonic -X compile $(MAIN).tex \
	  --outdir $(OUTDIR) --keep-intermediates --reruns 0
	  
	# 2. Process bibliography
	biber --input-directory $(OUTDIR) --output-directory $(OUTDIR) $(MAIN)
	
	# 3. Process acronyms
	makeindex -s $(OUTDIR)/$(MAIN).ist -t $(OUTDIR)/$(MAIN).alg -o $(OUTDIR)/$(MAIN).acr $(OUTDIR)/$(MAIN).acn
	
	# 4. Final pass (with search-path so Tectonic finds the .acr and .bbl files)
	tectonic -X compile $(MAIN).tex \
	  --outdir $(OUTDIR) -Z search-path=$(OUTDIR)

clean:
	rm -rf $(OUTDIR)