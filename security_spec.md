# Especificação de Segurança Firestore — El Nathan Transportes

## 1. Invariantes de Dados (Data Invariants)
1. **Isolamento de PII e Acesso Restrito**: Todos os documentos nas coleções `proprietarios`, `motoristas`, `veiculos`, `documentos`, `financeiro`, `categorias_financeiras` e `fretes` contêm dados pessoais/empresariais (CPF, CNPJ, CNH, telefone, RENAVAM, valores). Apenas usuários autenticados que sejam proprietários do registro (`ownerUid == request.auth.uid`) ou administradores verificados (`isAdmin()`, exigindo `email_verified == true`) podem ler (`get`/`list`) ou gravar dados.
2. **Integridade de Identidade**: Nenhum usuário pode criar registros atribuindo `ownerUid` a outro UID (`incoming().ownerUid == request.auth.uid`), nem alterar `ownerUid` ou `createdAt` após a criação.
3. **Integridade Temporal**: `createdAt` na criação e `updatedAt` em criação/atualização devem ser estritamente iguais a `request.time`.
4. **Higiene de IDs e Limites Volumétricos**: Todos os IDs de documentos devem corresponder a `^[a-zA-Z0-9_\-]+$` (<= 128 caracteres) via `isValidId()`. Todas as strings têm `.size()` explícito, valores numéricos em `financeiro` e `fretes` são validados (`>= 0 && <= 100000000`) e arrays (`camposPendentes`) têm limite máximo de 15 itens com validação de tipo.
5. **Consistência Relacional**: Quando um `Motorista`, `Veículo`, `LancamentoFinanceiro` ou `Frete` referencia `proprietarioId`, `motoristaId` ou `veiculoId` não vazios, o documento referenciado deve existir e pertencer ao mesmo usuário (ou admin). Da mesma forma, `Documento.entidadeId` deve apontar para um registro existente na coleção correspondente (`motoristas`, `veiculos` ou `proprietarios`).

## 2. "Dirty Dozen" Payloads (Tentativas de Violação Bloqueadas)
1. **Unauthenticated Read/List**: Tentativa de `get` ou `list` em `/motoristas` sem `request.auth`. -> `PERMISSION_DENIED`
2. **Unverified Email Spoof**: Usuário autenticado com `email: "joaomacedogondim22@gmail.com"`, mas `email_verified: false` tentando ler `/proprietarios`. -> `PERMISSION_DENIED`
3. **Cross-Tenant PII Read**: Usuário B autenticado tentando `get` em `/motoristas/{id}` pertencente ao Usuário A. -> `PERMISSION_DENIED`
4. **Unscoped List Query**: Usuário B tentando `list` em `/veiculos` sem filtro `where('ownerUid', '==', uidB)`. -> `PERMISSION_DENIED`
5. **Identity Spoofing on Create**: Usuário B tentando criar um motorista com `ownerUid: uidA`. -> `PERMISSION_DENIED`
6. **Shadow / Ghost Field Injection**: Payload válido de criação de `Motorista` incluindo campo extra `isAdmin: true` ou `ghostField: "abc"`. -> `PERMISSION_DENIED`
7. **ID Poisoning**: Tentativa de criar `/veiculos/placa$com!caracteres_invalidos_e_1500_bytes...`. -> `PERMISSION_DENIED`
8. **Fake Timestamp Injection**: Criação de `Proprietario` com `createdAt` definido manualmente no cliente diferente de `request.time`. -> `PERMISSION_DENIED`
9. **Immortal Field Tampering**: Atualização de `Veículo` tentando alterar `ownerUid` ou `createdAt`. -> `PERMISSION_DENIED`
10. **Invalid Enum Value**: Atualização de `Veículo` tentando definir `tipoVeiculo: "Caminhão Bitrem"` (fora de `['', 'Van', 'HR', 'VUC', 'Médio']`) ou `situacaoCadastral: "hacked"`. -> `PERMISSION_DENIED`
11. **Array Type / Size Poisoning**: Criação de `Motorista` com `camposPendentes` contendo 50 itens ou `[12345]`. -> `PERMISSION_DENIED`
12. **Orphaned Reference Create**: Criação de `Documento` com `entidadeTipo: "veiculo"` e `entidadeId: "veiculo_inexistente"`. -> `PERMISSION_DENIED`
