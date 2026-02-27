MAIN = main
OUTDIR = build

.PHONY: all pdf clean

all: pdf

pdf:
	mkdir -p $(OUTDIR)

	# First pass
	tectonic --outdir $(OUTDIR) --keep-logs --keep-intermediates $(MAIN).tex

	# Glossaries (acronyms)
	makeindex \
	  -s $(OUTDIR)/$(MAIN).ist \
	  -t $(OUTDIR)/$(MAIN).alg \
	  -o $(OUTDIR)/$(MAIN).acr \
	  $(OUTDIR)/$(MAIN).acn

	# Final pass
	tectonic --outdir $(OUTDIR) \
	  --keep-logs --keep-intermediates \
	  -Z search-path=$(OUTDIR) \
	  $(MAIN).tex

clean:
	rm -rf $(OUTDIR)