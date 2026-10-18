using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RoomConditions.v2.Migrations
{
    /// <inheritdoc />
    public partial class MjerenjaSaKlimom : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MjerenjaOkoline",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DeviceId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TemperaturaC = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VlaznostZraka = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DatumVrijemePrijemaUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    KlimaUkljucena = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MjerenjaOkoline", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MjerenjaOkoline");
        }
    }
}
