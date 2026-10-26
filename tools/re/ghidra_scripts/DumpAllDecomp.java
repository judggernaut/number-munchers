// Dump every function's decompiled pseudocode and disassembly for offline grep.
// Usage: analyzeHeadless <proj> nm -import NM_UNPACKED.EXE -postScript DumpAllDecomp.java <outfile>
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.listing.*;
import ghidra.program.model.address.*;
import java.io.*;

public class DumpAllDecomp extends GhidraScript {
    public void run() throws Exception {
        String[] args = getScriptArgs();
        File out = new File(args.length > 0 ? args[0] : "/tmp/decomp.txt");
        DecompInterface di = new DecompInterface();
        di.toggleCCode(true);
        di.toggleSyntaxTree(true);
        di.openProgram(currentProgram);
        PrintWriter w = new PrintWriter(new BufferedWriter(new FileWriter(out)));
        FunctionManager fm = currentProgram.getFunctionManager();
        int n = 0;
        for (Function f : fm.getFunctions(true)) {
            w.println("//=== FUNC " + f.getName() + " @ " + f.getEntryPoint()
                    + " body=" + f.getBody().getNumAddresses());
            try {
                DecompileResults res = di.decompileFunction(f, 60, monitor);
                if (res != null && res.decompileCompleted()) {
                    w.println(res.getDecompiledFunction().getC());
                } else {
                    w.println("// decompile failed: " + (res == null ? "null" : res.getErrorMessage()));
                }
            } catch (Exception e) {
                w.println("// decompile exception: " + e);
            }
            n++;
        }
        w.close();
        println("wrote " + n + " functions to " + out);
    }
}
